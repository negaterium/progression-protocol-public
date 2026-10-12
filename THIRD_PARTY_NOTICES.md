# Third-party notices

This repository is an unofficial, non-commercial fan project. The project name,
catalog references and other source-universe material do not imply affiliation
with or endorsement by any rights holder. See the [fan-project notice](docs/FAN_PROJECT_NOTICE.md).

The application uses the packages listed below. Their own license terms remain
in force; this project does not relicense them under the MIT license in `LICENSE`.
The versions and SPDX identifiers are taken from `package-lock.json`. Refresh
this inventory when the lockfile changes and retain the license files supplied by
each package manager installation.

## Generation model notice

The retained visual assets were generated locally by the project owner with SDXL 1.0
using text-only prompts and no reference images. The repository distributes the
generated outputs, not SDXL weights or generation software. The SDXL 1.0 model
license is the [CreativeML Open RAIL++-M license](https://github.com/Stability-AI/generative-models/blob/main/model_licenses/LICENSE-SDXL1.0);
its use restrictions apply to model use, while the license states that Stability
claims no rights in generated output. The exact checkpoint or adapter revision was
not retained; review any non-standard component before adding new outputs.

## Runtime dependencies

| Package | Locked version | License |
| --- | ---: | --- |
| `@radix-ui/react-dialog` | 1.1.15 | MIT |
| `@radix-ui/react-label` | 2.1.8 | MIT |
| `@radix-ui/react-progress` | 1.1.8 | MIT |
| `@radix-ui/react-separator` | 1.1.8 | MIT |
| `@radix-ui/react-slot` | 1.2.4 | MIT |
| `@types/bcryptjs` | 2.4.6 | MIT |
| `bcryptjs` | 3.0.3 | BSD-3-Clause |
| `canvas-confetti` | 1.9.4 | ISC |
| `class-variance-authority` | 0.7.1 | Apache-2.0 |
| `clsx` | 2.1.1 | MIT |
| `date-fns` | 4.1.0 | MIT |
| `lucide-react` | 0.562.0 | ISC |
| `next` | 16.4.0 | MIT |
| `pg` | 8.20.0 | MIT |
| `react` | 19.2.3 | MIT |
| `react-dom` | 19.2.3 | MIT |
| `recharts` | 3.8.1 | MIT |
| `tailwind-merge` | 3.5.0 | MIT |
| `tailwindcss-animate` | 1.0.7 | MIT |
| `zod` | 3.25.76 | MIT |

## Development dependencies

| Package | Locked version | License |
| --- | ---: | --- |
| `@tailwindcss/postcss` | 4.2.2 | MIT |
| `@types/node` | 20.19.39 | MIT |
| `@types/pg` | 8.20.0 | MIT |
| `@types/react` | 19.2.14 | MIT |
| `@types/react-dom` | 19.2.3 | MIT |
| `autoprefixer` | 10.4.27 | MIT |
| `dotenv` | 17.4.1 | BSD-2-Clause |
| `eslint` | 9.39.4 | MIT |
| `eslint-config-next` | 16.4.0 | MIT |
| `jsdom` | 27.4.0 | MIT |
| `tailwindcss` | 4.2.2 | MIT |
| `tsx` | 4.21.0 | MIT |
| `tw-animate-css` | 1.4.0 | MIT |
| `typescript` | 5.9.3 | Apache-2.0 |
| `vitest` | 4.1.4 | MIT |

Transitive packages are resolved by the lockfile and retain their own license
files under `node_modules`. A release archive or container image must preserve
the package-manager metadata and comply with any additional notices required by
those packages.

Bundled artwork, fonts, screenshots, catalog text and other creative material
are outside this dependency inventory. Their release status is tracked in
[ASSET_REVIEW.md](docs/ASSET_REVIEW.md) and must be cleared separately.
