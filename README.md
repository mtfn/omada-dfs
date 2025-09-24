# omada-dfs
DFS recovery script for TP-Link Omada access points

## Environment variables
Server, CID, client ID, and client secret can be obtained by creating a platform integration. Navigate to Settings --> Platform Integration and make a new app in Client mode and give it the appropriate permissions for the site(s) to be managed.

- `SERVER`: Address of Omada controller, in the form `https://something:8043`, click eye icon in Platform Integration
- `CID`: Omada CID, eye icon
- `CLIENT_ID`: Omada integration client ID
- `CLIENT_SECRET`: Omada integration client secret
- `SITE_ID`: Not sure how to easily find this. Navigate to the site in browser controller, then open developer console and look around in SessionStorage for a key containing something like `siteName` and a hexadecimal value.
- `APS`: Comma separated list of AP mac addresses, like `AA-BB-CC-DD-EE-FF,00-11-22-33-44-55`
- `INTERVAL`: How often to recover, in milliseconds. Should comply with API rate limits.
