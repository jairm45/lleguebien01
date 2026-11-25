// EAS expone las variables de tipo archivo como una ruta durante el build.
module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  if (!googleServicesFile) return config;
  return {
    ...config,
    android: { ...config.android, googleServicesFile },
  };
};
