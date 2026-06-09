/* This function finds all colors, including gradients, pseudoelements, and
 * regular hex codes in a webpage, and inverts the by taking the difference 
 * from #ffffff. You can use it just by copying the entire thing, and pasting 
 * it into the browser console (Fn + F12).
 */

(function() {
    // Helper function to convert an RGB/RGBA string to an array of numbers
    function parseRgb(rgbString) {
        const match = rgbString.match(/\d+(\.\d+)?/g);
        return match ? match.map(Number) : null;
    }

    // Helper function to invert RGB values (subtracting from 255)
    function invertRgb(rgbArray) {
        if (!rgbArray) return null;
        const r = 255 - rgbArray[0];
        const g = 255 - rgbArray[1];
        const b = 255 - rgbArray[2];
        const a = rgbArray[3] !== undefined ? rgbArray[3] : 1;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    // Helper function to find and invert colors inside complex strings (shadows, gradients)
    function invertComplexColors(cssString) {
        if (!cssString || cssString === 'none') return null;
        const rgbRegex = /rgba?\(.*?\)/g;
        return cssString.replace(rgbRegex, (match) => {
            const parsed = parseRgb(match);
            return parsed ? invertRgb(parsed) : match;
        });
    }

    // Helper to extract properties from a computed style object and turn them into inverted CSS
    function getInvertedStylesForTarget(computedStyle) {
        let rules = '';
        
        const bgColor = computedStyle.backgroundColor;
        const textColor = computedStyle.color;
        const boxShadow = computedStyle.boxShadow;
        const bgImage = computedStyle.backgroundImage;
        const borderColor = computedStyle.borderColor;
        const outlineColor = computedStyle.outlineColor;

        if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
            const parsed = parseRgb(bgColor);
            if (parsed) rules += `background-color: ${invertRgb(parsed)} !important;`;
        }
        if (textColor) {
            const parsed = parseRgb(textColor);
            if (parsed) rules += `color: ${invertRgb(parsed)} !important;`;
        }
        if (boxShadow && boxShadow !== 'none') {
            const inverted = invertComplexColors(boxShadow);
            if (inverted) rules += `box-shadow: ${inverted} !important;`;
        }
        if (bgImage && bgImage !== 'none' && bgImage.includes('-gradient')) {
            const inverted = invertComplexColors(bgImage);
            if (inverted) rules += `background-image: ${inverted} !important;`;
        }
        if (borderColor && borderColor !== 'transparent' && borderColor !== 'rgba(0, 0, 0, 0)') {
            // Note: shorthand borderColor can contain 1 to 4 colors. Invert complex handles space-separated rgb strings beautifully.
            const inverted = invertComplexColors(borderColor);
            if (inverted) rules += `border-color: ${inverted} !important;`;
        }
        if (outlineColor && outlineColor !== 'transparent' && outlineColor !== 'rgba(0, 0, 0, 0)') {
            const parsed = parseRgb(outlineColor);
            if (parsed) rules += `outline-color: ${invertRgb(parsed)} !important;`;
        }

        return rules;
    }

    const styleSheet = document.createElement("style");
    document.head.appendChild(styleSheet);
    let cssRules = '';

    const allElements = document.querySelectorAll('*');

    allElements.forEach((el, index) => {
        const uniqueClass = `inverted-color-${index}`;
        let appliedClass = false;

        // 1. Handle Main Element
        const mainStyle = window.getComputedStyle(el);
        const mainRules = getInvertedStylesForTarget(mainStyle);
        if (mainRules) {
            cssRules += `.${uniqueClass} { ${mainRules} }\n`;
            appliedClass = true;
        }

        // 2. Handle ::before Pseudo-element
        const beforeStyle = window.getComputedStyle(el, '::before');
        // Pseudo-elements always return computed styles, we check if it actually has content/render presence
        if (beforeStyle && beforeStyle.content && beforeStyle.content !== 'none') {
            const beforeRules = getInvertedStylesForTarget(beforeStyle);
            if (beforeRules) {
                cssRules += `.${uniqueClass}::before { ${beforeRules} }\n`;
                appliedClass = true;
            }
        }

        // 3. Handle ::after Pseudo-element
        const afterStyle = window.getComputedStyle(el, '::after');
        if (afterStyle && afterStyle.content && afterStyle.content !== 'none') {
            const afterRules = getInvertedStylesForTarget(afterStyle);
            if (afterRules) {
                cssRules += `.${uniqueClass}::after { ${afterRules} }\n`;
                appliedClass = true;
            }
        }

        // Apply class if main element or either pseudo-element required an inversion
        if (appliedClass) {
            el.classList.add(uniqueClass);
        }
    });

    styleSheet.textContent = cssRules;
    console.log('Successfully inverted elements, borders, outlines, and pseudo-elements!');
})();
