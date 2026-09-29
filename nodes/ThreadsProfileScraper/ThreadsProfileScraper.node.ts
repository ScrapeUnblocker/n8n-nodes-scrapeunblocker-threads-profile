import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import type { OptionField } from './GenericFunctions';
import { applyOptions, requireList, runActorAndGetItems } from './GenericFunctions';

// ScrapeUnblocker's public "Threads Profile Scraper" Actor: https://apify.com/scrapeunblocker/threads-profile-scraper
const ACTOR_ID = '9hYtUYoupR31dMBWC';
const INTEGRATION_APP_ID = 'scrapeunblocker-threads-profile-scraper';

// Node option name -> Actor input key.
const OPTION_FIELDS: Record<string, OptionField> = {
	maxPosts: {
		key: 'max_posts',
	},
	proxyCountry: {
		key: 'proxy_country',
	},
};

function buildActorInput(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	options: IDataObject,
	itemIndex: number,
): IDataObject {
	const input: IDataObject = {};

	switch (`${resource}:${operation}`) {
		case 'profile:get': {
			input.usernames = requireList.call(this, 'usernames', 'Usernames or Profile URLs', itemIndex);
			break;
		}
		default:
			throw new NodeOperationError(
				this.getNode(),
				`The operation "${operation}" is not supported for resource "${resource}"`,
				{ itemIndex },
			);
	}

	applyOptions(input, options, OPTION_FIELDS);
	return input;
}

export class ThreadsProfileScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Threads Profile Scraper',
		name: 'threadsProfileScraper',
		icon: {
			light: 'file:threadsProfileScraper.png',
			dark: 'file:threadsProfileScraper.dark.png',
		},
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Get public Threads profiles with their recent posts with the ScrapeUnblocker Actor on Apify',
		defaults: {
			name: 'Threads Profile Scraper',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'apifyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Profile',
						value: 'profile',
					},
				],
				default: 'profile',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['profile'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get public Threads profiles with their recent posts',
						action: 'Get profiles',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Usernames or Profile URLs',
				name: 'usernames',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'zuck, mosseri',
				description:
					"One or more Threads handles ('zuck', '@zuck') or profile URLs ('https://www.threads.com/@zuck')",
				displayOptions: {
					show: {
						resource: ['profile'],
						operation: ['get'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Max Posts Per Profile',
						name: 'maxPosts',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
						default: 25,
						description:
							'How many recent posts to return per profile (1-100). The profile page carries roughly the newest 10-25.',
					},
					{
						displayName: 'Proxy Country',
						name: 'proxyCountry',
						type: 'options',
						options: [
							{
								name: 'Brazil',
								value: 'BR',
							},
							{
								name: 'Canada',
								value: 'CA',
							},
							{
								name: 'France',
								value: 'FR',
							},
							{
								name: 'Germany',
								value: 'DE',
							},
							{
								name: 'Italy',
								value: 'IT',
							},
							{
								name: 'Japan',
								value: 'JP',
							},
							{
								name: 'Netherlands',
								value: 'NL',
							},
							{
								name: 'Random',
								value: '',
							},
							{
								name: 'Spain',
								value: 'ES',
							},
							{
								name: 'United Kingdom',
								value: 'GB',
							},
							{
								name: 'United States',
								value: 'US',
							},
						],
						default: '',
						description: 'Country to fetch the profiles from. Random picks one automatically.',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 0,
						description:
							'Maximum run time of the Apify Actor run. 0 keeps the Actor default. A run that times out fails the node.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const { timeout, ...actorOptions } = options;

				const input = buildActorInput.call(this, resource, operation, actorOptions, i);
				const { items: results } = await runActorAndGetItems.call(this, {
					actorId: ACTOR_ID,
					integrationAppId: INTEGRATION_APP_ID,
					input,
					itemIndex: i,
					timeoutSecs: (timeout as number) || undefined,
				});

				for (const result of results) {
					returnData.push({ json: result, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors return an error of their own class unchanged.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
