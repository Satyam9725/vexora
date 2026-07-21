import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { obfuscator } from 'rollup-obfuscator';

export default {
  input: 'Vexora.js', // Main entry point
  external: (id) => {
    if (id === 'Vexora.js' || id.endsWith('Vexora.js')) return false;
    return !id.startsWith('.') && !path.isAbsolute(id);
  },
  output: {
    file: 'dist/vexora.min.js', // Output file
    format: 'esm', // ES module format
    sourcemap: false
  },
  plugins: [
    resolve(),
    commonjs(),
    obfuscator({
      compact: true,
      controlFlowFlattening: true,
      numbersToExpressions: true,
      simplify: true,
      stringArray: true,
      stringArrayThreshold: 0.75
    })
  ]
};
