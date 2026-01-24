/**
 * Brand theme extraction script (simplified)
 * Extracts design tokens from vicipeptides.com using Playwright
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return rgb;
  const [r, g, b] = match.map(Number);
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeColor(color: string): string {
  if (color.startsWith('rgb')) {
    return rgbToHex(color);
  }
  return color;
}

function extractPrimaryFont(fontFamily: string): string {
  return fontFamily.split(',')[0].trim().replace(/['"]/g, '');
}

async function extractBrandTheme(): Promise<void> {
  console.log('🎨 Starting brand theme extraction from vicipeptides.com...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://vicipeptides.com/', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Page loaded successfully\n');

    // Extract basic styles using simple selectors
    console.log('📝 Extracting typography...');
    const typography = await page.evaluate(`
      (function() {
        const body = document.body;
        const h1 = document.querySelector('h1');
        const h2 = document.querySelector('h2');
        const button = document.querySelector('button, .btn, [role="button"]');
        const nav = document.querySelector('nav, header nav, header');
        
        const getStyle = function(el, prop) {
          if (!el) return null;
          return window.getComputedStyle(el).getPropertyValue(prop) || null;
        };
        
        return {
          body: {
            fontFamily: getStyle(body, 'font-family'),
            fontSize: getStyle(body, 'font-size'),
            fontWeight: getStyle(body, 'font-weight'),
            lineHeight: getStyle(body, 'line-height'),
            color: getStyle(body, 'color'),
          },
          h1: h1 ? {
            fontFamily: getStyle(h1, 'font-family'),
            fontSize: getStyle(h1, 'font-size'),
            fontWeight: getStyle(h1, 'font-weight'),
            lineHeight: getStyle(h1, 'line-height'),
            color: getStyle(h1, 'color'),
          } : null,
          h2: h2 ? {
            fontFamily: getStyle(h2, 'font-family'),
            fontSize: getStyle(h2, 'font-size'),
            fontWeight: getStyle(h2, 'font-weight'),
            lineHeight: getStyle(h2, 'line-height'),
            color: getStyle(h2, 'color'),
          } : null,
          button: button ? {
            fontFamily: getStyle(button, 'font-family'),
            fontSize: getStyle(button, 'font-size'),
            fontWeight: getStyle(button, 'font-weight'),
            color: getStyle(button, 'color'),
            backgroundColor: getStyle(button, 'background-color'),
            borderRadius: getStyle(button, 'border-radius'),
            padding: getStyle(button, 'padding'),
          } : null,
          nav: nav ? {
            fontFamily: getStyle(nav, 'font-family'),
            fontSize: getStyle(nav, 'font-size'),
            fontWeight: getStyle(nav, 'font-weight'),
            color: getStyle(nav, 'color'),
            backgroundColor: getStyle(nav, 'background-color'),
          } : null,
        };
      })()
    `);

    // Extract colors from common elements
    console.log('🎨 Extracting color palette...');
    const colors = await page.evaluate(`
      (function() {
        const body = document.body;
        const header = document.querySelector('header');
        const button = document.querySelector('button, .btn, [role="button"]');
        const link = document.querySelector('a');
        
        const getColor = function(el) {
          if (!el) return null;
          const styles = window.getComputedStyle(el);
          return {
            bg: styles.backgroundColor,
            fg: styles.color,
          };
        };
        
        return {
          body: getColor(body),
          header: getColor(header),
          button: getColor(button),
          link: getColor(link),
        };
      })()
    `);

    // Extract spacing and border radius
    console.log('📏 Extracting spacing and border radius...');
    const spacing = await page.evaluate(`
      (function() {
        const button = document.querySelector('button, .btn');
        const card = document.querySelector('.card, [class*="card"]');
        const container = document.querySelector('.container, [class*="container"]');
        
        const getSpacing = function(el) {
          if (!el) return null;
          const styles = window.getComputedStyle(el);
          return {
            padding: styles.padding,
            margin: styles.margin,
            borderRadius: styles.borderRadius,
          };
        };
        
        return {
          button: getSpacing(button),
          card: getSpacing(card),
          container: getSpacing(container),
        };
      })()
    `);

    // Process extracted data
    console.log('\n🔄 Processing extracted data...');

    const primaryColor = (colors as any).button?.fg || (colors as any).link?.fg || (colors as any).body?.fg || '#1a1a1a';
    const backgroundColor = (colors as any).body?.bg || (colors as any).header?.bg || '#ffffff';
    const accentColor = (colors as any).button?.bg || (colors as any).link?.fg || '#8b5cf6';

    const tokens = {
      colors: {
        primary: normalizeColor(primaryColor),
        secondary: normalizeColor((colors as any).body?.fg || '#4a4a4a'),
        accent: normalizeColor(accentColor),
        background: normalizeColor(backgroundColor),
        foreground: normalizeColor((colors as any).body?.fg || '#1a1a1a'),
        muted: '#f5f5f5',
        mutedForeground: '#737373',
        border: '#e5e5e5',
        input: '#ffffff',
        ring: normalizeColor(accentColor),
      },
      typography: {
        fontFamily: {
          sans: (typography as any).body?.fontFamily 
            ? [extractPrimaryFont((typography as any).body.fontFamily), 'sans-serif']
            : ['Inter', 'sans-serif'],
        },
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: (typography as any).body?.fontSize || '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
          '4xl': '2.25rem',
        },
        fontWeight: {
          normal: (typography as any).body?.fontWeight || '400',
          medium: '500',
          semibold: '600',
          bold: (typography as any).h1?.fontWeight || '700',
        },
        headings: {
          h1: {
            fontSize: (typography as any).h1?.fontSize || '2.25rem',
            fontWeight: (typography as any).h1?.fontWeight || '700',
          },
          h2: {
            fontSize: (typography as any).h2?.fontSize || '1.875rem',
            fontWeight: (typography as any).h2?.fontWeight || '600',
          },
        },
      },
      spacing: {
        scale: ['0', '0.25', '0.5', '0.75', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '8', '10', '12', '16'],
      },
      borderRadius: {
        none: '0',
        sm: (spacing as any).button?.borderRadius || '0.125rem',
        base: '0.25rem',
        md: '0.375rem',
        lg: (spacing as any).card?.borderRadius || '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      buttons: {
        borderRadius: (spacing as any).button?.borderRadius || '0.375rem',
        padding: (spacing as any).button?.padding || '0.5rem 1rem',
        fontWeight: (typography as any).button?.fontWeight || '600',
      },
      cards: {
        borderRadius: (spacing as any).card?.borderRadius || '0.5rem',
        backgroundColor: normalizeColor(backgroundColor),
        border: '1px solid #e5e5e5',
        padding: (spacing as any).card?.padding || '1.5rem',
      },
    };

    // Ensure theme directory exists
    const themeDir = join(process.cwd(), 'theme');
    mkdirSync(themeDir, { recursive: true });

    // Write JSON file
    const jsonPath = join(themeDir, 'brand-tokens.json');
    writeFileSync(jsonPath, JSON.stringify(tokens, null, 2));
    console.log(`✅ Written: ${jsonPath}`);

    // Write TypeScript file
    const tsPath = join(themeDir, 'brand-tokens.ts');
    const tsContent = `/**
 * Brand tokens extracted from vicipeptides.com
 * Generated: ${new Date().toISOString()}
 * Source: https://vicipeptides.com/
 */

export const brandTokens = ${JSON.stringify(tokens, null, 2)} as const;

export type BrandTokens = typeof brandTokens;
`;
    writeFileSync(tsPath, tsContent);
    console.log(`✅ Written: ${tsPath}`);

    console.log('\n🎉 Brand theme extraction complete!');
    console.log('\n📊 Summary:');
    console.log(`   Primary Color: ${tokens.colors.primary}`);
    console.log(`   Background: ${tokens.colors.background}`);
    console.log(`   Accent: ${tokens.colors.accent}`);
    console.log(`   Font Family: ${tokens.typography.fontFamily.sans[0]}`);

  } catch (error) {
    console.error('❌ Error during extraction:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

extractBrandTheme().catch(console.error);
