# 🖼️ Image optimization Vite plugin ⚡
This Vite + React plugin **stores optimized versions** of your images within a persistent file cache and **uses them** for your bundles.

## 📦 Install
`npm i vite-plugin-react-simg -D`

## 🏁 Getting started
Add **simg** to your Vite plugins.

```js
// vite.config.js

import simg from 'vite-plugin-react-simg';

export default {
    plugins: [
        simg(),
        // other plugins
    ]
}
```