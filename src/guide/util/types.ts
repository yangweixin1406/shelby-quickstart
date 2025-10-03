export interface ShelbyConfig {
	accounts: {
		[name: string]: {
			address: string
			private_key: string
		}
	}
	contexts: {
		[name: string]: {
			aptos_network: string
			shelby_rpc_endpoint: string
		}
	}
	default_account?: string
	default_context?: string
}
export interface EnvVariables {
	account_name: string
	address: string
	private_key: string
	context_name: string
	network: string
	rpc: string
}
