{ pkgs, inputs, ... }:
{
  packages = builtins.attrValues (import ./nix/toolchain.nix { inherit pkgs; sdk = inputs.projectSdk; });
}
