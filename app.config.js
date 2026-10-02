// Configuration dynamique : chemin de base du site web (ex. /daret-manager pour GitHub Pages).
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.BASE_URL || '' },
});
