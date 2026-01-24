import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic'

// Helper to get WooCommerce credentials (checked at runtime, not build time)
function getWooCommerceCredentials() {
  const WOOCOMMERCE_STORE_URL = process.env.WOOCOMMERCE_STORE_URL
  const WOOCOMMERCE_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY
  const WOOCOMMERCE_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET

  if (!WOOCOMMERCE_STORE_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
    throw new Error('Missing WooCommerce credentials')
  }

  return { WOOCOMMERCE_STORE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET }
}

// Helper to make WooCommerce API requests
async function wooCommerceRequest(method: string, endpoint: string, body?: any) {
  const { WOOCOMMERCE_STORE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = getWooCommerceCredentials()
  const url = `${WOOCOMMERCE_STORE_URL}/wp-json/wc/v3${endpoint}`
  const auth = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64')

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WooCommerce API error: ${response.status} - ${error}`)
  }

  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Create product in WooCommerce
    const wooProduct = await wooCommerceRequest('POST', '/products', {
      name: body.name,
      type: body.type || 'simple',
      regular_price: String(body.regular_price || body.price || '0'),
      description: body.description || '',
      short_description: body.short_description || '',
      sku: body.sku || '',
      manage_stock: body.manage_stock !== undefined ? body.manage_stock : false,
      stock_quantity: body.stock_quantity || null,
      stock_status: body.stock_status || 'instock',
      status: body.status || 'publish',
      categories: body.categories || [],
      images: body.images || [],
    })

    // Sync to Supabase
    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('products')
      .select('product_id')
      .eq('woo_product_id', wooProduct.id)
      .maybeSingle()

    const productData = {
      woo_product_id: wooProduct.id,
      product_name: wooProduct.name,
      sku_code: wooProduct.sku || null,
      retail_price: parseFloat(wooProduct.regular_price || '0'),
      our_cost: body.our_cost ? parseFloat(String(body.our_cost)) : null,
      stock_status: wooProduct.stock_status === 'instock' ? 'OK' : 'OUT OF STOCK',
      current_stock: wooProduct.stock_quantity || 0,
      starting_qty: wooProduct.stock_quantity || 0,
    }

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('product_id', existing.product_id)
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json(data, { status: 200 })
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json(data, { status: 201 })
    }
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create product' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check if request was aborted
    if (request.signal?.aborted) {
      return NextResponse.json({ error: 'Request aborted' }, { status: 499 })
    }

    const { searchParams } = new URL(request.url)
    const product_id = searchParams.get('product_id')
    const woo_product_id = searchParams.get('woo_product_id')

    if (!product_id && !woo_product_id) {
      return NextResponse.json(
        { error: 'product_id or woo_product_id required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Get product to find WooCommerce ID
    let wooId: number | null = null
    if (woo_product_id) {
      wooId = parseInt(woo_product_id)
    } else if (product_id) {
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('woo_product_id')
        .eq('product_id', parseInt(product_id))
        .single()
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }
      
      wooId = product?.woo_product_id || null
    }

    // Delete from WooCommerce if we have the ID
    if (wooId) {
      try {
        await wooCommerceRequest('DELETE', `/products/${wooId}?force=true`)
      } catch (error) {
        // Log but don't fail - product may already be deleted in WooCommerce
        console.warn('Failed to delete from WooCommerce (may already be deleted):', error)
      }
    }

    // Delete from Supabase
    const deleteQuery = product_id
      ? supabase.from('products').delete().eq('product_id', parseInt(product_id))
      : supabase.from('products').delete().eq('woo_product_id', wooId!)

    const { error: deleteError, data } = await deleteQuery

    if (deleteError) {
      throw deleteError
    }

    // Return success response with proper headers
    return NextResponse.json(
      { 
        success: true,
        message: 'Product deleted successfully',
        deleted: {
          product_id: product_id ? parseInt(product_id) : null,
          woo_product_id: wooId,
        }
      },
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, must-revalidate',
        }
      }
    )
  } catch (error) {
    console.error('Error deleting product:', error)
    
    // Check if error is due to request being aborted
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request was cancelled' },
        { status: 499 }
      )
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to delete product',
        success: false
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )
  }
}
