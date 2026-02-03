'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface UseRealtimeOptions {
  table: 'orders' | 'order_lines' | 'expenses'
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
  enabled?: boolean
}

/**
 * Hook for Supabase Realtime subscriptions
 * Automatically subscribes on mount and cleans up on unmount
 */
export function useRealtime({
  table,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isCleaningUpRef = useRef(false)
  const [isConnected, setIsConnected] = useState(false)
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete })
  
  // Update callbacks ref when they change (without triggering re-subscription)
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete }
  }, [onInsert, onUpdate, onDelete])

  // Memoize supabase client to prevent recreation
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false)
      if (channelRef.current) {
        isCleaningUpRef.current = true
        channelRef.current.unsubscribe()
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        isCleaningUpRef.current = false
      }
      return
    }

    // Clean up existing channel if any
    if (channelRef.current) {
      isCleaningUpRef.current = true
      channelRef.current.unsubscribe()
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
      isCleaningUpRef.current = false
    }

    // Create channel with stable name (no Date.now() to prevent re-subscriptions)
    const channelName = `${table}_changes`
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          // Check if we're cleaning up - ignore messages during cleanup
          if (isCleaningUpRef.current) {
            return
          }

          // Use ref to get latest callbacks without re-subscribing
          const { onInsert, onUpdate, onDelete } = callbacksRef.current

          // Trigger appropriate callback - wrap in try-catch to prevent errors from breaking subscription
          try {
            if (payload.eventType === 'INSERT' && onInsert) {
              onInsert(payload.new)
            } else if (payload.eventType === 'UPDATE' && onUpdate) {
              onUpdate(payload.new)
            } else if (payload.eventType === 'DELETE' && onDelete) {
              onDelete(payload.old)
            }
          } catch (error) {
            console.error(`Error in realtime callback for ${table}:`, error)
          }
        }
      )
      .subscribe((status, err) => {
        // Check if we're in cleanup phase using ref
        const isCleanup = isCleaningUpRef.current

        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Realtime subscription SUBSCRIBED for ${table}`)
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false)
          // Don't spam console: Realtime may be disabled in Supabase or RLS may block anon.
          // App still works; data updates on page refresh or when user navigates.
          if (!isCleanup && process.env.NODE_ENV === 'development') {
            if (err) {
              console.warn(`Realtime ${table}: ${status}`, err.message || err)
            }
          }
        } else if (status === 'CLOSED') {
          setIsConnected(false)
        } else {
          setIsConnected(false)
        }
      })

    channelRef.current = channel

    // Cleanup on unmount or when dependencies change
    return () => {
      if (channelRef.current) {
        isCleaningUpRef.current = true
        // Wait a bit to ensure any pending messages are processed
        setTimeout(() => {
          // Unsubscribe first to prevent CLOSED events from being logged
          if (channelRef.current) {
            channelRef.current.unsubscribe()
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
            setIsConnected(false)
          }
          isCleaningUpRef.current = false
        }, 100)
      }
    }
  }, [table, enabled, supabase]) // Only depend on table and enabled, not callbacks

  return {
    channel: channelRef.current,
    isConnected,
  }
}
