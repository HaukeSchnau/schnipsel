{ pkgs, sdk }: import "${sdk}/lib/toolchain.nix" { inherit pkgs; } // { inherit (pkgs) bun; }
