// Declarações de tipos para importação de CSS (resolvidas pelo Metro em runtime).
// Sem isto, o `tsc --noEmit` acusa os imports de .css do template Expo.

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css';
