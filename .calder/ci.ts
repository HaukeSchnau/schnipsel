import { Bun, Project } from "@calder-ci/std";
import { flake } from "./flake.ts";

const shell = flake.devShells.ci;

export default Project.standard({ flake, vp: { shell, setup: Bun.install({ shell }) } });
