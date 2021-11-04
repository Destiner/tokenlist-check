import axios from 'axios';
import { providers } from 'ethers';
import { Call, Contract, Provider } from 'ethcall';

import erc20Abi from '../abi/erc20.json';

const provider = providers.getDefaultProvider(1);

interface TokenlistToken {
	address: string;
	chainId: number;
	decimals: number;
	name: string;
	symbol: string;
}

interface Tokenlist {
	name: string;
	tokens: TokenlistToken[];
}

async function run() {
	const url = 'https://tokens.coingecko.com/all.json';
	const list = await fetchList(url);
	await checkList(list);
}

async function fetchList(url: string) {
	const listResponse = await axios.get<Tokenlist>(url);
	const brokenTokens = [
		'0x2859021ee7f2cb10162e67f33af2d22764b31aff',
		'0xc16b542ff490e01fcc0dc58a60e1efdc3e357ca6',
		'0xe0b7927c4af23765cb51314a0e0521a9645f0e2a',
		'0x0af44e2784637218dd1d32a322d44e603a8f0c6a',
		'0x47140a767a861f7a1f3b0dd22a2f463421c28814',
		'0x5e3845a1d78db544613edbe43dc1ea497266d3b8',
		'0x1c5b760f133220855340003b43cc9113ec494823',
		'0x6f2afbf4f5e5e804c5b954889d7bf3768a3c9a45',
		'0x0000000000000000000000000000000000000000',
	];
	const list = {
		name: listResponse.data.name,
		tokens: listResponse.data.tokens
			.filter((token) => !brokenTokens.includes(token.address.toLowerCase())),
	};
	return list;
}

async function checkList(list: Tokenlist) {
	await checkDecimals(list);
}

async function checkDecimals(list: Tokenlist) {
	const calls = list.tokens.map((token) => {
		const contract = new Contract(token.address, erc20Abi);
		return contract.decimals() as Call;
	});
	const decimals = await fetchCalls<number>(calls, 18);
	list.tokens.forEach((token, index) => {
		const tokenlistDecimals = token.decimals;
		const onchainDecimals = decimals[index];
		if (tokenlistDecimals != onchainDecimals) {
			console.error(
				`Wrong decimals for ${token.address}, expected ${onchainDecimals}, actual ${tokenlistDecimals}`
			);
		}
	});
}

async function fetchCalls<T>(allCalls: Call[], defaultValue: T) {
	const limit = 50;

	const ethcallProvider = new Provider();
	await ethcallProvider.init(provider);

	const allResults: T[] = [];
	for (let i = 0; i < allCalls.length / limit; i++) {
		const startIndex = i * limit;
		const endIndex = Math.min((i + 1) * limit, allCalls.length);
		const calls = allCalls.slice(startIndex, endIndex);
		const results = await ethcallProvider.tryAll<T>(calls);
		for (const result of results) {
			if (result !== null) {
				allResults.push(result)
			} else {
				allResults.push(defaultValue);
			}
		}
	}
	return allResults;
}

run();
