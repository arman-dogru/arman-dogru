KaTeX 0.19.0, MIT licensed. Self-hosted: the chat loads no third-party scripts.

Source: https://www.npmjs.com/package/katex/v/0.19.0

Registry integrity:
`sha512-v6Tznz3zJ7u3niRCoDTsumM2+HA2XXcCu+WAacCeHD2z3p9A9Ks987o5FzfTGBN0e8A0vjEgIDvLbICrXpdw/Q==`

Rebuild using the pinned package's `dist/katex.mjs` as the esbuild input, with
`--bundle --minify --format=esm --outfile=assets/vendor/katex-0.19.0.mjs`.
Keep `katex-LICENSE.txt`. The renderer requests MathML output only, with trust
disabled and bounded expansion/size. Native browser math needs no font downloads.
