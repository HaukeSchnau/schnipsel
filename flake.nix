{
  description = "Schnipsel's toolchain";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    projects-sdk = {
      url = "github:HaukeSchnau/projects-sdk/v0.1.0";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, projects-sdk, ... }:
    let
      toolchain = pkgs: import ./nix/toolchain.nix { inherit pkgs; sdk = projects-sdk; };
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
