import { ThreadsProfileScraper } from './nodes/ThreadsProfileScraper/ThreadsProfileScraper.node';
import { ApifyApi } from './credentials/ApifyApi.credentials';

export const nodeTypes = [ThreadsProfileScraper];

export const credentialTypes = [ApifyApi];
