variable "docker-config" {
  type = object({
    image = string
    tag   = string
  })
  default = {
    image = "githubservices.azurecr.io/kermit"
    tag   = "latest"
  }
}

variable "resource-group" {
  type = object({
    name     = string
    location = string
  })
  default = {
    name     = "kermit"
    location = "eastus"
  }
}

variable "app-service-plan" {
  type = object({
    name     = string
    os-type  = string
    sku-name = string
  })
  default = {
    name     = "kermit-appserviceplan"
    os-type  = "Linux"
    sku-name = "P1v3"
  }
}

variable "linux-web-app-name" {
  type    = string
  default = "kermit"
}
