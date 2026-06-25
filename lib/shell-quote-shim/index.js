// Minimal shell-quote shim for react-devtools-core compatibility
exports.quote = function(args) {
  return args.map(function(a) {
    if (typeof a === 'object') return a.op || '';
    return String(a).replace(/(["\s'$`\\])/g, '\\$1');
  }).join(' ');
};

exports.parse = function(str) {
  return str.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [];
};
