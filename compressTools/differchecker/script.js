function compareTexts() {
    const text1 = document.getElementById('text1').value.split('\n');
    const text2 = document.getElementById('text2').value.split('\n');
    let result = '';

    const maxLength = Math.max(text1.length, text2.length);

    for (let i = 0; i < maxLength; i++) {
        const line1 = text1[i] || '';
        const line2 = text2[i] || '';

        if (line1 === line2) {
            result += line1 + '\n';
        } else {
            result += `- ${line1}\n+ ${line2}\n`;
        }
    }

    document.getElementById('result').innerText = result || 'No differences found.';
}
