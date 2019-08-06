# Visual Studio Code Duffle Tools

An extension for developers building Cloud Native Application Bundles using the CNAB standard and the Duffle CNAB implementation.  Features include:

* Create Duffle build definitions using snippets and templates
* Build CNAB bundles from a Duffle build definition
* Warn of problems in a build definition file
* Browse CNAB bundles in the Duffle local store
* Install, upgrade and uninstall CNAB bundles
* View your installed bundles
* Create and populate Duffle credential sets

This is a beta release of the extension.  Please report any bugs or problems, and let us know if you have any suggestions or feature requests!  You can reach us via our [GitHub issues page](https://github.com/deislabs/duffle-vscode/issues).

## Getting started with the extension

### Dependencies

You will need the `duffle` command line tool on your system PATH.

If you have `duffle` but it is not on your path, you can tell the extension where it is using the `vscode-duffle.duffle-path` configuration setting.

## Telemetry

This extension collects telemetry data to help us build a better experience for building applications with Duffle and CNAB. We only collect the following data:

* Which commands are executed.
* For the `Install` command, whether the installation succeeded or failed.

We do not collect any information about image names, paths, etc. The extension respects the `telemetry.enableTelemetry` setting which you can learn more about in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
