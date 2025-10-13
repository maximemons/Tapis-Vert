const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function importGames(jsonArray) {
  for (const item of jsonArray) {
	await setDocument(COLLECTIONS.JEUX, undefined, item);
    await sleep(1000);
  }
}

const data = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" }
];

importGames(data);
