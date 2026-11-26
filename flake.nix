{
  description = "Schnipsel's toolchain";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/e73ea54e41051f2d4b39890b56346beb5ef2aa88";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, nix-infra-modules, ... }:
    let
      toolchain = pkgs: import ./nix/toolchain.nix { inherit pkgs; sdk = nix-infra-modules; };
    in
    {
      # Calder's checks run in it: Bun installs, vp checks and tests on Node.
      devShells =
        nixpkgs.lib.genAttrs
          [
            "aarch64-linux"
            "x86_64-linux"
          ]
          (
            system:
            let
              pkgs = nixpkgs.legacyPackages.${system};
            in
            {
              ci = pkgs.mkShellNoCC {
                packages = builtins.attrValues (toolchain pkgs);
              };
            }
          );
    };
}
