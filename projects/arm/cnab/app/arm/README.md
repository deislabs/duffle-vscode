# Azure Resource Manager CNAB Project

The Duffle project you have just created builds a CNAB bundle whose sole component is a set of Azure Resource Manager (ARM) resources.  The ARM resources are defined in `template.json`.  The `template.json` in the generated project deploys an ACI (Azure Container Instances) container running a 'hello world' application.  You should replace this with an ARM template specifying the Azure resources you want to deploy as part of your application bundle.

You can expose ARM parameters as CNAB bundle parameters by right-clicking the parameter name in `template.json` and choosing `Expose as CNAB Parameter`.  Users of your bundle will then be able to override the default value during a `duffle install`.
