# Terraform CNAB Project

The Duffle project you have just created builds a CNAB bundle whose sole component is a set of Terraform resources.  The resources are defined in `cnab/app/tf/*.tf`.  The `.tf` files in the generated project deploy a Microsoft Azure Kubernetes Service cluster.  You should replace these with Terraform scripts specifying the cloud resources you want to deploy as part of your application bundle.
