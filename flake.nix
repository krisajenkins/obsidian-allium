{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

      in
      {
        packages = { };

        # allium-lsp (which ships the wasm-bindgen parser we vendor) is provided
        # by the user's profile; `scripts/refresh-wasm.sh` resolves it from PATH
        # and re-copies allium_wasm_bg.wasm when the language version bumps.
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            pnpm
            esbuild
          ];
        };
      });
}
