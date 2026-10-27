import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

// Package the existing demo UI; the live application and SQLite adapter stay unchanged.
await mkdir("dist-demo", { recursive: true });
await build({
  stdin: {
    contents: `import React from 'react';
import {createRoot} from 'react-dom/client';
import Room from './app/room/[id]/room';
import './app/globals.css';
try { localStorage.setItem('__storage_check','1'); localStorage.removeItem('__storage_check'); }
catch { const data=new Map(); Object.defineProperty(window,'localStorage',{value:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}}); }
try { new BroadcastChannel('__channel_check').close(); }
catch { window.BroadcastChannel=class { postMessage(){} close(){} }; }
const root=createRoot(document.getElementById('root'));
let revision=0;
const host=()=>root.render(<Room key={++revision} id="demo"/>);
document.getElementById('return-host').addEventListener('click',host);
document.addEventListener('click',event=>{const link=event.target.closest('a[href="/"]');if(link){event.preventDefault();host();}});
host();`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  outfile: "dist-demo/demo.js",
  platform: "browser",
  format: "iife",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".woff2": "dataurl", ".woff": "dataurl", ".ttf": "dataurl" },
});
await writeFile(
  "dist-demo/index.html",
  `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="התנסות במשחק חדר המצב — מנחה, משלחת ומסך הקרנה במכשיר אחד."><title>חדר המצב — התנסות</title><link rel="stylesheet" href="/demo.css"><link rel="stylesheet" href="/preview.css"><script defer src="/demo.js"></script></head>
<body><a class="skip-link" href="#main">דילוג לתוכן</a><section class="preview-toolbar" aria-label="בקרת גרסת התנסות"><span>גרסת התנסות · מכשיר אחד · ללא סנכרון בין מכשירים</span><button id="return-host">חזרה למנחה</button></section><div id="root"></div><noscript>כדי להפעיל את ההדגמה יש לאפשר JavaScript בדפדפן.</noscript></body></html>`,
);
await writeFile(
  "dist-demo/preview.css",
  `.preview-toolbar{background:#173e38;color:white;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}.preview-toolbar span{max-width:65%}.preview-toolbar button{font:inherit;background:white;color:#173e38;border:0;border-radius:5px;padding:9px 12px;min-height:44px;cursor:pointer}@media print{.preview-toolbar{display:none}}`,
);
console.log(
  "Vercel demo built in dist-demo/ (no API, database or deployment credentials required).",
);
