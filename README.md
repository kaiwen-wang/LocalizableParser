Put `Localizable.xcstrings` in top-level dir.

Create .env with `OPENAI_API_KEY="API-KEY-HERE"`

`node 1_sort_keys.js`
`node 2_translate_keys_parallel.js`
`node 3_merge_keys.ks`

Get final result in `output/4_final_xcstrigs/Localizable.xcstrings`

Todo:
- Turn into NPM package so you can `npx LParser`
    - Issue: still requires bringing own API key. Try to find free endpoint.
- Create a Github workflow that runs on push