function compareTexts() {
    const text1 = document.getElementById('text1').value.split('\n');
    const text2 = document.getElementById('text2').value.split('\n');
    let result1 = '';
    let result2 = '';

    const maxLength = Math.max(text1.length, text2.length);

    for (let i = 0; i < maxLength; i++) {
        const line1 = text1[i] || '';
        const line2 = text2[i] || '';

        if (line1 === line2) {
            result1 += line1 + '\n';
            result2 += line2 + '\n';
        } else {
            if (line1) {
                result1 += `<span class="removed">${line1}</span>\n`;
            }
            if (line2) {
                result2 += `<span class="added">${line2}</span>\n`;
            }
        }
    }

    document.getElementById('result').innerHTML = `
        <div class="result-column">${result1 || 'No differences found.'}</div>
        <div class="result-column">${result2 || 'No differences found.'}</div>
    `;
}
