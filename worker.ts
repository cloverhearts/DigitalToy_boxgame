type StaticAssetBinding = {
  fetch(request: Request): Promise<Response>;
};

type Environment = {
  ASSETS: StaticAssetBinding;
};

export default {
  fetch(request: Request, environment: Environment) {
    return environment.ASSETS.fetch(request);
  },
};
