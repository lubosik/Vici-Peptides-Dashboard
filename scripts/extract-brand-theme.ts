/**
 * Brand theme extraction script
 * Extracts design tokens from vicipeptides.com using Playwright
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface ExtractedTokens {
  colors: {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
    background: string | null;
    foreground: string | null;
    muted: string | null;
    mutedForeground: string | null;
    border: string | null;
    input: string | null;
    ring: string | null;
    allFrequent: string[];
  };
  typography: {
    fontFamily: {
      sans: string[];
      serif: string[] | null;
      mono: string[] | null;
    };
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
    headings: Record<string, any>;
    body: any;
    nav: any;
    button: any;
  };
  spacing: {
    scale: string[];
  };
  borderRadius: Record<string, string>;
  shadows: string[];
  buttons: any;
  cards: any;
  navigation: any;
  cssVariables: Record<string, string>;
}

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

    // Extract CSS Variables
    console.log('📋 Extracting CSS variables...');
    const cssVariables = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const variables: Record<string, string> = {};
      
      // Try to get CSS variables from stylesheets
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule) {
              const style = rule.style;
              for (let i = 0; i < style.length; i++) {
                const prop = style[i];
                if (prop.startsWith('--')) {
                  const value = root.getPropertyValue(prop).trim();
                  if (value) variables[prop] = value;
                }
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheets may throw
        }
      }
      
      return variables;
    });

    // Extract Typography
    console.log('📝 Extracting typography...');
    const typography = await page.evaluate(() => {
      const getStyles = (selector: any) => {
        try {
          const el = document.querySelector(selector);
          if (!el) return null;
          const styles = window.getComputedStyle(el);
          return {
            fontFamily: styles.fontFamily || null,
            fontSize: styles.fontSize || null,
            fontWeight: styles.fontWeight || null,
            lineHeight: styles.lineHeight || null,
            letterSpacing: styles.letterSpacing || null,
            textTransform: styles.textTransform || null,
            color: styles.color || null,
          };
        } catch (e) {
          return null;
        }
      };

      return {
        body: getStyles('body'),
        h1: getStyles('h1'),
        h2: getStyles('h2'),
        h3: getStyles('h3'),
        nav: getStyles('nav') || getStyles('.nav') || getStyles('[role="navigation"]') || getStyles('header nav'),
        button: getStyles('button') || getStyles('.btn') || getStyles('[role="button"]'),
        cardHeading: getStyles('.card h2') || getStyles('.card h3'),
      };
    });

    // Extract Color Palette
    console.log('🎨 Extracting color palette...');
    const colorPalette = await page.evaluate(() => {
      function extractColors(selector: any) {
        const elements = Array.from(document.querySelectorAll(selector));
        const colors: Record<string, number> = {};
        
        elements.forEach((el) => {
          const styles = window.getComputedStyle(el);
          const bg = styles.backgroundColor;
          const fg = styles.color;
          const border = styles.borderColor;
          
          [bg, fg, border].forEach((color) => {
            if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent' && color !== 'rgb(0, 0, 0)') {
              colors[color] = (colors[color] || 0) + 1;
            }
          });
        });
        
        return colors;
      }

      const bodyColors = extractColors('body');
      const headingColors = extractColors('h1, h2, h3, h4, h5, h6');
      const buttonColors = extractColors('button, .btn, [role="button"], a[class*="button"]');
      const linkColors = extractColors('a, [href]');
      const cardColors = extractColors('.card, [class*="card"], [class*="Card"]');
      const navColors = extractColors('nav, .nav, [role="navigation"], header');
      
      const allColors = { ...bodyColors, ...headingColors, ...buttonColors, ...linkColors, ...cardColors, ...navColors };
      const sortedColors = Object.entries(allColors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      // Find background (most common light color)
      const lightColors = sortedColors.filter(([color]) => {
        const match = color.match(/\d+/g);
        if (!match || match.length < 3) return false;
        const r = Number(match[0]);
        const g = Number(match[1]);
        const b = Number(match[2]);
        return r > 200 && g > 200 && b > 200; // Light colors
      });

      // Find foreground (most common dark color)
      const darkColors = sortedColors.filter(([color]) => {
        const match = color.match(/\d+/g);
        if (!match || match.length < 3) return false;
        const r = Number(match[0]);
        const g = Number(match[1]);
        const b = Number(match[2]);
        return r < 100 && g < 100 && b < 100; // Dark colors
      });

      // Find accent (color that's not gray)
      const accentColor = sortedColors.find(([color]) => {
        const match = color.match(/\d+/g);
        if (!match || match.length < 3) return false;
        const r = Number(match[0]);
        const g = Number(match[1]);
        const b = Number(match[2]);
        const isGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
        return !isGray && (r > 50 || g > 50 || b > 50);
      });

      return {
        primary: darkColors[0]?.[0] || sortedColors[0]?.[0] || null,
        secondary: darkColors[1]?.[0] || sortedColors[1]?.[0] || null,
        accent: accentColor?.[0] || null,
        background: lightColors[0]?.[0] || sortedColors.find(([c]) => c.includes('255'))?.[0] || '#ffffff',
        foreground: darkColors[0]?.[0] || '#000000',
        allFrequent: sortedColors.map(([color]) => color),
      };
    });

    // Extract Button Styles
    console.log('🔘 Extracting button styles...');
    const buttonStyles = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, .btn, [role="button"], a[class*="button"]'));
      if (buttons.length === 0) return null;
      
      const firstButton = buttons[0];
      const styles = window.getComputedStyle(firstButton);
      
      return {
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        border: styles.border,
        boxShadow: styles.boxShadow,
        fontWeight: styles.fontWeight,
        fontSize: styles.fontSize,
      };
    });

    // Extract Card Styles
    console.log('🃏 Extracting card styles...');
    const cardStyles = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.card, [class*="card"], [class*="Card"]'));
      if (cards.length === 0) return null;
      
      const firstCard = cards[0];
      const styles = window.getComputedStyle(firstCard);
      
      return {
        borderRadius: styles.borderRadius,
        backgroundColor: styles.backgroundColor,
        border: styles.border,
        boxShadow: styles.boxShadow,
        padding: styles.padding,
      };
    });

    // Extract Navigation Styles
    console.log('🧭 Extracting navigation styles...');
    const navStyles = await page.evaluate(() => {
      const nav = document.querySelector('nav, .nav, [role="navigation"], header nav, header');
      if (!nav) return null;
      
      const styles = window.getComputedStyle(nav);
      const link = nav.querySelector('a') || nav;
      const linkStyles = window.getComputedStyle(link);
      
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        padding: styles.padding,
        borderBottom: styles.borderBottom,
        linkColor: linkStyles.color,
        linkFontSize: linkStyles.fontSize,
        linkFontWeight: linkStyles.fontWeight,
        linkTextTransform: linkStyles.textTransform,
        linkLetterSpacing: linkStyles.letterSpacing,
      };
    });

    // Extract Spacing
    console.log('📏 Extracting spacing system...');
    const spacing = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const spacingValues: Record<string, number> = {};
      
      elements.slice(0, 100).forEach((el) => { // Limit to first 100 elements for performance
        const styles = window.getComputedStyle(el);
        ['padding', 'margin', 'gap'].forEach((prop) => {
          const value = styles.getPropertyValue(prop);
          if (value) {
            const match = value.match(/(\d+(?:\.\d+)?)(px|rem|em)/);
            if (match) {
              const num = parseFloat(match[1]);
              const unit = match[2];
              const key = `${num}${unit}`;
              spacingValues[key] = (spacingValues[key] || 0) + 1;
            }
          }
        });
      });
      
      const sorted = Object.entries(spacingValues)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 16)
        .map(([value]) => value);
      
      return sorted;
    });

    // Extract Border Radius
    console.log('🔲 Extracting border radius...');
    const borderRadius = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const radiusValues: Record<string, number> = {};
      
      elements.slice(0, 100).forEach((el) => {
        const styles = window.getComputedStyle(el);
        const radius = styles.borderRadius;
        if (radius && radius !== '0px') {
          radiusValues[radius] = (radiusValues[radius] || 0) + 1;
        }
      });
      
      const sorted = Object.entries(radiusValues)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([value]) => value);
      
      return sorted;
    });

    // Extract Shadows
    console.log('🌑 Extracting shadows...');
    const shadows = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const shadowValues: Record<string, number> = {};
      
      elements.slice(0, 100).forEach((el) => {
        const styles = window.getComputedStyle(el);
        const shadow = styles.boxShadow;
        if (shadow && shadow !== 'none') {
          shadowValues[shadow] = (shadowValues[shadow] || 0) + 1;
        }
      });
      
      const sorted = Object.entries(shadowValues)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value]) => value);
      
      return sorted;
    });

    // Process and normalize extracted data
    console.log('\n🔄 Processing extracted data...');

    const tokens: ExtractedTokens = {
      colors: {
        primary: colorPalette.primary ? normalizeColor(colorPalette.primary) : '#1a1a1a',
        secondary: colorPalette.secondary ? normalizeColor(colorPalette.secondary) : '#4a4a4a',
        accent: colorPalette.accent ? normalizeColor(colorPalette.accent) : null,
        background: colorPalette.background ? normalizeColor(colorPalette.background) : '#ffffff',
        foreground: colorPalette.foreground ? normalizeColor(colorPalette.foreground) : '#1a1a1a',
        muted: '#f5f5f5',
        mutedForeground: '#737373',
        border: '#e5e5e5',
        input: '#ffffff',
        ring: colorPalette.accent ? normalizeColor(colorPalette.accent) : '#8b5cf6',
        allFrequent: colorPalette.allFrequent.map(normalizeColor),
      },
      typography: {
        fontFamily: {
          sans: typography.body?.fontFamily 
            ? [extractPrimaryFont(typography.body.fontFamily), 'sans-serif']
            : ['Inter', 'sans-serif'],
          serif: typography.h1?.fontFamily && typography.h1.fontFamily !== typography.body?.fontFamily
            ? [extractPrimaryFont(typography.h1.fontFamily), 'serif']
            : null,
          mono: ['Fira Code', 'monospace'],
        },
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: typography.body?.fontSize || '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
          '4xl': '2.25rem',
        },
        fontWeight: {
          normal: typography.body?.fontWeight || '400',
          medium: '500',
          semibold: '600',
          bold: typography.h1?.fontWeight || '700',
        },
        lineHeight: {
          tight: '1.25',
          normal: typography.body?.lineHeight || '1.5',
          relaxed: '1.75',
        },
        headings: {
          h1: {
            fontFamily: typography.h1?.fontFamily ? extractPrimaryFont(typography.h1.fontFamily) : null,
            fontSize: typography.h1?.fontSize || '2.25rem',
            fontWeight: typography.h1?.fontWeight || '700',
            lineHeight: typography.h1?.lineHeight || '1.25',
          },
          h2: {
            fontFamily: typography.h2?.fontFamily ? extractPrimaryFont(typography.h2.fontFamily) : null,
            fontSize: typography.h2?.fontSize || '1.875rem',
            fontWeight: typography.h2?.fontWeight || '600',
            lineHeight: typography.h2?.lineHeight || '1.3',
          },
        },
        body: {
          fontFamily: typography.body?.fontFamily ? extractPrimaryFont(typography.body.fontFamily) : 'Inter',
          fontSize: typography.body?.fontSize || '1rem',
          fontWeight: typography.body?.fontWeight || '400',
          lineHeight: typography.body?.lineHeight || '1.5',
        },
        nav: {
          fontFamily: typography.nav?.fontFamily ? extractPrimaryFont(typography.nav.fontFamily) : 'Inter',
          fontSize: typography.nav?.fontSize || typography.button?.fontSize || '0.875rem',
          fontWeight: typography.nav?.fontWeight || '500',
          textTransform: typography.nav?.textTransform || 'none',
          letterSpacing: typography.nav?.letterSpacing || '0',
        },
        button: {
          fontFamily: typography.button?.fontFamily ? extractPrimaryFont(typography.button.fontFamily) : 'Inter',
          fontSize: typography.button?.fontSize || '0.875rem',
          fontWeight: typography.button?.fontWeight || '600',
          textTransform: typography.button?.textTransform || 'none',
        },
      },
      spacing: {
        scale: spacing.length > 0 ? spacing : ['0', '0.25', '0.5', '0.75', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '8', '10', '12', '16'],
      },
      borderRadius: {
        none: '0',
        sm: borderRadius[0] || '0.125rem',
        base: borderRadius[1] || '0.25rem',
        md: borderRadius[2] || '0.375rem',
        lg: borderRadius[3] || '0.5rem',
        xl: borderRadius[4] || '0.75rem',
        '2xl': borderRadius[5] || '1rem',
        full: '9999px',
      },
      shadows: shadows.length > 0 ? shadows : [
        '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      ],
      buttons: buttonStyles ? {
        borderRadius: buttonStyles.borderRadius || '0.375rem',
        padding: buttonStyles.padding,
        backgroundColor: normalizeColor(buttonStyles.backgroundColor),
        color: normalizeColor(buttonStyles.color),
        border: buttonStyles.border,
        boxShadow: buttonStyles.boxShadow,
        fontWeight: buttonStyles.fontWeight,
        fontSize: buttonStyles.fontSize,
      } : {
        borderRadius: '0.375rem',
        padding: { x: '1rem', y: '0.5rem' },
        fontWeight: '600',
      },
      cards: cardStyles ? {
        borderRadius: cardStyles.borderRadius || '0.5rem',
        backgroundColor: normalizeColor(cardStyles.backgroundColor),
        border: cardStyles.border,
        boxShadow: cardStyles.boxShadow,
        padding: cardStyles.padding,
      } : {
        borderRadius: '0.5rem',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e5',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        padding: '1.5rem',
      },
      navigation: navStyles ? {
        backgroundColor: normalizeColor(navStyles.backgroundColor),
        borderBottom: navStyles.borderBottom,
        linkColor: normalizeColor(navStyles.linkColor),
        linkFontSize: navStyles.linkFontSize,
        linkFontWeight: navStyles.linkFontWeight,
        linkTextTransform: navStyles.linkTextTransform,
        linkLetterSpacing: navStyles.linkLetterSpacing,
      } : {
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e5e5',
        linkColor: '#1a1a1a',
        linkFontSize: '0.875rem',
        linkFontWeight: '500',
        linkTextTransform: 'none',
        linkLetterSpacing: '0',
      },
      cssVariables: cssVariables,
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
    console.log(`   Colors: ${Object.keys(tokens.colors).length} extracted`);
    console.log(`   Typography: ${Object.keys(tokens.typography.fontFamily).length} font families`);
    console.log(`   CSS Variables: ${Object.keys(tokens.cssVariables).length} found`);
    console.log(`   Spacing values: ${tokens.spacing.scale.length}`);
    console.log(`   Border radius values: ${Object.keys(tokens.borderRadius).length}`);
    console.log(`   Shadow values: ${tokens.shadows.length}`);

  } catch (error) {
    console.error('❌ Error during extraction:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

extractBrandTheme().catch(console.error);
