const Webpack = require("webpack");
const Path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
// MiniCssExtractPlugin no usado — CSS cargado directo en HTML
// const MiniCssExtractPlugin = require("mini-css-extract-plugin");
// const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const opts = {
  rootDir: process.cwd(),
  devBuild: process.env.NODE_ENV !== "production"
};

module.exports = {
  // ─── ENTRADA ─────────────────────────────────────────────────────
  // app.js importa todo lo demás: scada-core.js, variable-manager.js, file-manager.js
  entry: {
    app: "./js/app.js"
  },

  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  devtool: process.env.NODE_ENV === "production" ? "source-map" : "inline-source-map",

  // ─── SALIDA ───────────────────────────────────────────────────────
  // Genera dist/js/app.js y dist/css/app.css dentro de SCADA/
  output: {
    path: Path.join(opts.rootDir, "dist"),
    pathinfo: opts.devBuild,
    filename: "js/[name].js",
    chunkFilename: "js/[name].js",
    publicPath: "/",
    clean: true                          // limpia dist/ antes de cada build
  },

  performance: { hints: false },

  optimization: {
    minimizer: [
      new TerserPlugin({ parallel: true, terserOptions: { ecma: 2015 } })
    ],
    runtimeChunk: false
  },

  // ─── PLUGINS ─────────────────────────────────────────────────────
  plugins: [
    // Copia assets estáticos a dist/
    new CopyWebpackPlugin({
      patterns: [
        { from: "assets", to: "assets", noErrorOnMissing: true },
        { from: "Acceso_seguro/models", to: "Acceso_seguro/models", noErrorOnMissing: true },
        { from: "Acceso_seguro/pid",    to: "Acceso_seguro/pid",    noErrorOnMissing: true }
      ]
    })
  ],

  // ─── LOADERS ─────────────────────────────────────────────────────
  module: {
    rules: [
      // Babel — transpila JS moderno
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: { cacheDirectory: true }
        }
      },
      // CSS/SCSS no se procesa aquí — se carga directamente en index.html
      // Descomenta si vuelves a importar CSS desde app.js:
      // { test: /\.(sa|sc|c)ss$/, use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader", "sass-loader"] },
      // Fuentes
      {
        test: /\.(woff2?|ttf|eot|svg)(\?.*)?$/,
        type: "asset/resource",
        generator: { filename: "fonts/[name][ext]" }
      },
      // Imágenes
      {
        test: /\.(png|jpe?g|gif|webp)(\?.*)?$/,
        type: "asset/resource",
        generator: { filename: "assets/img/[name][ext]" }
      }
    ]
  },

  // ─── RESOLVE ─────────────────────────────────────────────────────
  resolve: {
    extensions: [".js", ".scss", ".css"],
    modules: [
      "node_modules",
      Path.resolve(opts.rootDir, "../node_modules") // hereda node_modules del proyecto raíz
    ],
    alias: { request$: "xhr" }
  },

  // ─── DEV SERVER ──────────────────────────────────────────────────
  devServer: {
    // Sirve archivos estáticos desde SCADA/ (index.html, assets, css, js originales)
    static: {
      directory: Path.join(__dirname, "."),
      publicPath: "/"
    },
    // Los bundles compilados (dist/js/app.js, dist/css/app.css) se sirven
    // en memoria desde / gracias al publicPath: "/" del output
    devMiddleware: {
      publicPath: "/",
      writeToDisk: false       // no escribe en disco en desarrollo
    },
    port: 8080,
    hot: true,
    open: "/index.html",
    historyApiFallback: { index: "/index.html" },

    // ─── APIs del servidor ───────────────────────────────────────
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) throw new Error("webpack-dev-server is not defined");

      const fs   = require("fs");
      const path = require("path");
      const bodyParser = require("body-parser");

      devServer.app.use(bodyParser.json());

      const SCADA_ROOT = __dirname;
      const SECURE_ROOT = path.join(SCADA_ROOT, 'Acceso_seguro');
      if (!fs.existsSync(SECURE_ROOT)) fs.mkdirSync(SECURE_ROOT);

      const getSafePath = (queryPath) => {
        const safe = path.normalize(queryPath || "/").replace(/^(\.\.(\/|\\|$))+/, '');
        return path.join(SECURE_ROOT, safe);
      };

      // GET /api/files/list
      devServer.app.get("/api/files/list", (req, res) => {
        const targetDir = getSafePath(req.query.path);
        try {
          if (!fs.existsSync(targetDir)) return res.json([]);
          const list = fs.readdirSync(targetDir);
          let results = [];
          list.forEach(file => {
            const filePath = path.join(targetDir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) results.push({ type: "directory", name: file });
            else results.push({ type: "file", name: file, size: stat.size });
          });
          res.json(results);
        } catch (e) { res.status(500).json({ error: e.message }); }
      });

      // GET /api/files/raw
      devServer.app.get("/api/files/raw", (req, res) => {
        const targetFile = getSafePath(path.join(req.query.path || "", req.query.name || ""));
        try {
          if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
            res.sendFile(targetFile);
          } else {
            res.status(404).send("File not found");
          }
        } catch (e) { res.status(500).send(e.message); }
      });

      // GET /api/files/download
      devServer.app.get("/api/files/download", (req, res) => {
        const targetFile = getSafePath(path.join(req.query.path || "", req.query.name || ""));
        try {
          if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
            res.download(targetFile);
          } else {
            res.status(404).send("File not found");
          }
        } catch (e) { res.status(500).send(e.message); }
      });

      // POST /api/files/mkdir
      devServer.app.post("/api/files/mkdir", (req, res) => {
        const fullPath = getSafePath(path.join(req.body.path || "", req.body.name || ""));
        try {
          if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            res.json({ success: true });
          } else res.status(400).json({ error: "Carpeta existente" });
        } catch (e) { res.status(500).json({ error: e.message }); }
      });

      // POST /api/files/upload
      const multer = require('multer');
      const upload = multer({ dest: path.join(SCADA_ROOT, 'tmp_uploads') });
      devServer.app.post("/api/files/upload", upload.single('file'), (req, res) => {
        const targetDir = getSafePath(req.query.path);
        try {
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          const targetFile = path.join(targetDir, req.file.originalname);
          fs.renameSync(req.file.path, targetFile);
          res.json({ success: true });
        } catch (e) { 
          if(req.file) fs.unlinkSync(req.file.path);
          res.status(500).json({ error: e.message }); 
        }
      });

      // DELETE /api/files/delete (Soporta GET/POST/DELETE)
      devServer.app.all("/api/files/delete", (req, res) => {
        const p = req.body.path || req.query.path || "";
        const n = req.body.name || req.query.name || "";
        const fullPath = getSafePath(path.join(p, n));
        try {
          if (fs.existsSync(fullPath)) {
            const stat = fs.statSync(fullPath);
            stat.isDirectory() ? fs.rmSync(fullPath, { recursive: true, force: true }) : fs.unlinkSync(fullPath);
            res.json({ success: true });
          } else res.status(404).json({ error: "No encontrado" });
        } catch (e) { res.status(500).json({ error: e.message }); }
      });

      return middlewares;
    }
  }
};
