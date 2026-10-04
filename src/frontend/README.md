# Angular UI

Read the [project README](../../README.md) and [development guide](../../docs/local-development.md).

```sh
npm ci
npm start
npm test -- --watch=false
npm run build
```

The development server at http://127.0.0.1:4200 proxies `/api` and `/uploads` to FastAPI at http://127.0.0.1:8100. Bootstrap, Font Awesome and ngx-toastr are installed locally through npm. Unit HTTP fixtures live only in unit tests; real browser acceptance uses PostgreSQL and the running API.
