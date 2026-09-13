const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');

// Inline CSS
h = h.replace(/<link rel="stylesheet" href="css\/style\.css[^"]*">/, () => {
  return '<style>\n' + fs.readFileSync('css/style.css', 'utf8') + '\n</style>';
});

// Inline JS
h = h.replace(/<script src="js\/core\.js[^"]*"><\/script>/, () => {
  return '<script>\n' +
    fs.readFileSync('js/core.js', 'utf8') + '\n\n' +
    fs.readFileSync('js/access.js', 'utf8') + '\n\n' +
    fs.readFileSync('js/mobile.js', 'utf8') + '\n</script>';
});

h = h.replace(/<script src="js\/access\.js[^"]*"><\/script>/, '');
h = h.replace(/<script src="js\/mobile\.js[^"]*"><\/script>/, '');

fs.writeFileSync('WorkTree.html', h, 'utf8');
console.log('WorkTree.html bundled successfully via scripts/bundle.js!');
