# Kermit
A GitHub App built with [Probot](https://github.com/probot/probot) that spills the tea. This Probot application can be deployed as an Azure Web App (via docker container) to help facilitate the delegated bypass request process. In general the application listens for a `exemption_request_secret_scanning` event in a GitHub repository and then

- Identifies which Organization role(s) contain the `org_review_and_manage_secret_scanning_bypass_requests` permission
- Identifies which Team(s) have the required roles assigned
- Creates and udpates a GitHub Issue to provide more details about a given Secret Scanning alert push protection bypass request

<img width="1268" alt="image" src="https://github.com/user-attachments/assets/81b769e9-6c33-49c3-982b-9c9977338924">


## Functional Architecture

### Components
#### 1. Event Listener:

- The app listens to GitHub events using the app.onAny method.
- It specifically handles events related to secret scanning exemption requests.

#### 2. Event Handlers:

- **Created Event:** When an exemption request is created, the app fetches roles with specific permissions, retrieves teams associated with those roles, and creates a GitHub issue with detailed information about the request.
- **Completed Event:** When an exemption request is completed, the app updates the issue's labels and state, and adds a comment indicating whether the request was approved or denied.
- **Response Dismissed Event:** When a response to an exemption request is dismissed, the app updates the issue's labels and state, and adds a comment.
- **Response Submitted Event:** When a response to an exemption request is submitted, the app updates the issue's labels and state, and adds a comment.

#### 3. Helper Functions:

- **fetchRolesWithPermission:** Fetches organization roles that have the permission to review and manage secret scanning bypass requests.
- **fetchTeamsForRoles:** Fetches teams associated with the roles that have the required permissions.
- **updateIssueLabels:** Updates the labels of an issue based on the new status of the exemption request.
- **findIssueByTitle:** Finds an issue in the repository by its title.
- **processExemptionRequest:** Processes a newly created exemption request by creating a GitHub issue with detailed information.
- **handleExemptionRequestUpdate:** Handles updates to exemption requests by updating issue labels, state, and adding comments.

<img width="803" alt="image" src="https://github.com/user-attachments/assets/7bb7b049-88c1-4a12-9573-2fc18e102d8a">


## Requirements
1. A GitHub App must be installed on the Organization that you wish to enable Issues-based collaboration for delegated bypass requests on
     - The **GitHub App name** must be supplied with a name (e.g., my-org-kermit)
     - The **Homepage URL** must be provided (e.g., https://github.com/expert-services/kermit )
     - The initial **Webhook URL** must be a temporary one (e.g., https://example.com)
     - A **Webhook secret** must be generated and used
     - It must have
       - **Read-and-Write** to **Issues** as a Repository permission
       - **Read-only** to **Secret scanning alerts** as a Repository permission
       - **Read-only** to **Custom organization roles** as an Organization permission
       - **Read-only** to **Members** as an Organization permission
     - It must be subscribed to the **Exemption request secret scanning** event
     - It should be installed **Only on this account** (i.e., not on Any account)

> [!NOTE]  
> Organization permissions need to be approved by an Organization Owner

2. Generate a **Private key** for the GitHub App and Base64 encode the associated `.pem` file

    ```console
    foo@bar:~$ base64 -i oodles-noodles-kermit.YYYY-MM-DD.private-key.pem
    LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFb3dJQkFBS0NBUUVBa2xwaVlUdEZQbG5kdWdySDNOcGlvaGNZN1ZwNTlYMkhGTjJXM
    jZKdHkzYkRJWTJCClpJc20rRGN5dEZNb0kxbUg3UGUvUk1CN0xuOXZLS2N5Sk1kNVRuakxwUTBZWGdCOFRlQzdTa2tHNFB3alZKWlEKK1RlN3hiQU
    ...
    ...

    foo@bar:~$
    ```
3. Install the GitHub App on all the repositories in the Organization
4. Create a repository to store needed configuration items and deploy required infrastructure
5. Create values the following as **Repository secrets** in the repository created in Step 4
     - **CLIENT_ID**: The client ID of the Azure App Registration used to deploy infrastructure
     - **TENANT_ID**: The tenant ID of the Azure App Registration used to deploy infrastructure
     - **SUBSCRIPTION_ID**: The subscription ID of the Azure subscription that infrastructure is to be deployed to
     - **APP_ID**: The GitHub App ID
     - **WEBHOOK_SECRET**: The Webhook secret specified when creating the GitHub App
     - **PRIVATE_KEY**: The Base64 string associated with the GitHub Apps Private key `.pem` file

## Deploy Infrastructure 
Infrastructure is required to process webhook events. Several Azure services are used to provide the needed runtimes, configurations, and storage.

> **Note**
> In this case it is assumed that a Federated credential for GitHub Actions has been [correctly configured](https://github.com/marketplace/actions/azure-login#configure-a-federated-credential-to-use-oidc-based-authentication).

### Terraform
Use GitHub Actions 🚀 to execute Terraform CLI commands 

1. Create a file named `/.github/workflows/deploy_to_azure.yml` in the repository created during Step 4 of the Requirements section. Optionally update the `app-name:` value that is used in the names of Azure resources

```
name: Kermit
on:
  workflow_dispatch:
  push:
    branches: ['main']
    paths:
      - 'terraform/**'
jobs:     
  Deploy:
    uses: expert-services/reusable-workflows/.github/workflows/deploy_github_app.yml@main
    with:
      app-name: kermit
      cloud-provider: az
    secrets: inherit
```

2. Copy the contents of [terraform/](terraform/) into the repository created during Step 4 of the Requirements section
   1. Optionally edit the default values in the `variables.tf` file copied in Step 1
3. Upon committing the files Step 2 observe the `deploy_to_azure.yml` workflow execute
4. Update the GitHub App **Webook URL** mentioned in Step 1 of the Requirements section to the URL of the App Service that is deployed

> **Note**
> If using the default values in [terraform/variables.tf](terraform/variables.tf), resources will be deployed in the East US region

### State Management
Code is included as part of the referenced reusable workflow at  [expert-services/reusable-workflows/.github/workflows/deploy_github_app.yml](https://github.com/expert-services/reusable-workflows/blob/main/.github/workflows/deploy_github_app.yml) to boostrap and maintain the needed Azure infrastructure for Terraform state files. The workflow creates an Azure Storage Account `<app-name>state<GITHUB_ORG>` (omitting `-` characters, limiting the name to 24 characters), as well as a storage container named `<GITHUB_ORG>-tfstate` if they are not present. This Azure Storage Account is then referenced as part of a backend configuration for Terraform state when initializing with the `terraform` CLI. If these values create a collision or are not up to the desired naming standards, change them before executing the workflow.

```powershell 
...
...

terraform init -backend-config="resource_group_name=$($storageAccount.ResourceGroupName)" `
               -backend-config="storage_account_name=$($storageAccount.StorageAccountName)" `
               -backend-config="container_name=$env:GITHUB_REPOSITORY_OWNER-tfstate" `
               -backend-config="key=prod.terraform.tfstate" `
               -backend-config="use_oidc=true" `
               -backend-config="subscription_id=$env:TF_VAR_subscription_id" `
               -backend-config="tenant_id=$env:TF_VAR_tenant_id" `
               -backend-config="client_id=$env:TF_VAR_client_id" && terraform plan -out out.tfplan && terraform apply -auto-approve out.tfplan

...
...
```


## Local Development

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t delegated-bypass-notifier .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> delegated-bypass-notifier
```

## Contributing

If you have suggestions for how delegated-bypass-notifier could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2024 David Wiggs
