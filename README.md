[![JSR](https://jsr.io/badges/@fenv-org/genhtml-report-parser)](https://jsr.io/@fenv-org/genhtml-report-parser)
[![JSR Score](https://jsr.io/badges/@fenv-org/genhtml-report-parser/score)](https://jsr.io/@fenv-org/genhtml-report-parser)
[![Deno](https://img.shields.io/badge/deno-v2.2.10-brightgreen.svg)](https://deno.land/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

# genhtml-report-parser

A Deno module for parsing `genhtml` (LCOV) HTML coverage reports into structured
JSON. Supports extracting coverage statistics and file/directory hierarchies
from `index.html` files or zipped report archives.

## Features

- Parse `genhtml` HTML coverage reports (from directory or zip file)
- Extracts coverage stats and file/directory structure
- Outputs structured JSON for further processing or analysis
- Usable as a Deno module

## Installation

This project uses [Deno](https://deno.com/). No installation is required; you
can run scripts directly.

## Usage

### As a Module

```typescript
import {
  findRootIndexFile,
  parseRootIndexFile,
} from "jsr:@fenv-org/genhtml-report-parser";

const rootIndexFile = await findRootIndexFile("/path/to/report/dir"); // or "/path/to/report.zip";
const report = await parseRootIndexFile(rootIndexFile.absolutePath);
console.log(report);
```

## API

- `findRootIndexFile(path: string)`: Finds the root `index.html` in a directory
  or zip file.
- `parseRootIndexFile(filepath: string)`: Parses the report and returns a
  structured object with coverage stats and file/directory tree.

## Types

- `GenhtmlReport`: Root object with directory and parsed tree.
- `GenhtmlReportStats`: Coverage statistics (see
  [arXiv:2008.07947](https://arxiv.org/pdf/2008.07947)).
- `FilePath`: Absolute and relative file paths.

## Development

- Requires Deno
- See `.vscode/extensions.json` for recommended extensions

## License

MIT License
