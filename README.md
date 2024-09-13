# Kermit

A GitHub App built with [Probot](https://github.com/probot/probot) that helps facilitate the delegated bypass request process

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

## Setup

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
