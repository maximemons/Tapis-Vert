//COMMON
const APIURLDICTIONARY = "https://script.google.com/macros/s/AKfycbyzjfuKBjNQcTcjdmq1bG_FqG9R-_WbFQWYVORu56nREbjAlOUWiTSrd79nK18wGqS4LA/exec";
const APIURLLIBRARY = "https://script.google.com/macros/s/AKfycbxRZfCtY9Pt8f8Jme9BRpNW5N-m5gGENnz5elfMdbcGcdLNNTBJX6UsWqy700yMFC7d/exec";

const lsUpdateDate = "UpdateDate";
const lsGameDictionary = "gameDictionary";
const lsGameLibrary = "gamesLibrary";

async function getDataFromAPI(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erreur lors de la requête :', error);
    return null;
  }
}

function getDataFromLS(ls) {
  let localStorageContent = localStorage.getItem(ls);
  let localStorageTime = localStorage.getItem(ls+lsUpdateDate);

  if(localStorageContent == null || localStorageTime == null) {
    return null;
  }

  return {
    "timestamp": parseInt(localStorageTime),
    "data": JSON.parse(localStorageContent)
  };
}

function saveDataInLS(ls, data) {
  localStorage.setItem(ls, JSON.stringify(data));
  localStorage.setItem(ls+lsUpdateDate, new Date().getTime());
}


//DICTIONARY
async function getGamesDictionary() {
  //On essaie de récupérer les données depuis le local storage.
  let datasFromLS = getDataFromLS(lsGameDictionary);
  if(datasFromLS != null) {
	  return datasFromLS.data;
  }
  //On va chercher les données via l'API
  showLoader();
  let datasFromAPI = await getDataFromAPI(APIURLDICTIONARY);
  if(datasFromAPI != null) {
    saveDataInLS(lsGameDictionary, datasFromAPI);
  }
  hideLoader();
  return datasFromAPI;
}

async function updateGameDictionaryIfNecessary() {
  let datasFromLS = getDataFromLS(lsGameDictionary);
  if(datasFromLS != null) {
	let timeFromLS = datasFromLS.timestamp;
	//On regarde si on a pas eu de mise a jour sur la base distante
    let collectionLastUpdate = await getDataFromAPI(APIURLDICTIONARY + "?time=true");
	if(collectionLastUpdate.timestamp < timeFromLS) {
      return;
    }
  }
  let datasFromAPI = await getDataFromAPI(APIURLDICTIONARY);
  if(datasFromAPI != null) {
    saveDataInLS(lsGameDictionary, datasFromAPI);
  }
  return datasFromAPI;
}

//GAMES
async function getGameLibrary() {
  //On essaie de récupérer les données depuis le local storage.
  let datasFromLS = getDataFromLS(lsGameLibrary);
  if(datasFromLS != null) {
	  return datasFromLS.data;
  }
  //On va chercher les données via l'API
  showLoader();
  let datasFromAPI = await getDataFromAPI(APIURLLIBRARY);
  if(datasFromAPI != null) {
    saveDataInLS(lsGameLibrary, datasFromAPI);
  }
  hideLoader();
  return datasFromAPI;
}

async function updateGameLibraryIfNecessary() {
  let datasFromLS = getDataFromLS(lsGameLibrary);
  if(datasFromLS != null) {
	let timeFromLS = datasFromLS.timestamp;
	//On regarde si on a pas eu de mise a jour sur la base distante
  let collectionLastUpdate = await getDataFromAPI(APIURLLIBRARY + "?time=true");
	if(collectionLastUpdate.timestamp < timeFromLS) {
      return;
    }
  }
  let datasFromAPI = await getDataFromAPI(APIURLLIBRARY);
  if(datasFromAPI != null) {
    saveDataInLS(lsGameLibrary, datasFromAPI);
  }
  return datasFromAPI;
}
