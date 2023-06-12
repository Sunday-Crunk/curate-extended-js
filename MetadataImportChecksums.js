function curateNotification(input, token){ //send a notification to a Curate user
    if (input.NodeId){
        const url = "https://demo.curate.penwern.co.uk/a/scheduler/hooks/notifynode"
    }else{
        const url = "https://demo.curate.penwern.co.uk/a/scheduler/hooks/notify"
    }
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({"JobParameters":input})
    };
    fetch("https://demo.curate.penwern.co.uk/a/scheduler/hooks/notify", fetchOptions)
    .then(response => response.text())
    .then(result => console.log(result))
    .catch(err => console.error('error', err));
}
function searchNodesWithTokens(bearerToken, body) { //get tree 
    const url = 'https://demo.curate.penwern.co.uk/a/tree/stats';
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: body
    };
    return fetch(url, fetchOptions);
}
function generateJson(files) {  //convert upload input to nodepaths
    const ps = Object.values(files).map(obj => `${getOpenWS()}/${obj.webkitRelativePath}`);
    const result = {
        "NodePaths": ps
    }
    return JSON.stringify(result);
}
function associateNodes(inputA, inputB, folderMode) { //associate pre-upload files with Curate nodes
    console.log("input import: ", inputA)
    console.log("input nodes: ", inputB)
  const result = []; // initialize an empty result array
  for (const nodeA of inputA) {
    const filename = nodeA.filename.replace(/^objects\//, ''); // remove "objects/" prefix
    for (const nodeB of inputB) {
      if (nodeB.Path === filename) {
        nodeA.filename = nodeB.Uuid;
        result.push(nodeA); // add the matched nodeA to the result array
        break; // stop looking for matches for this nodeA
      }
    }
  }
  return result;
}
function convertMetadataArrayToObject(metadataArray) { //convert import metadata to Curate meta update body
  const metaDatas = [];
  metadataArray.forEach(metadata => {
    const nodeId = metadata.filename;
    delete metadata.filename;
    Object.entries(metadata).forEach(([namespace, jsonValue]) => {
      metaDatas.push({
        NodeUuid: nodeId,
        Namespace: `usermeta-${namespace.replace(".","-")}`,
        JsonValue: JSON.stringify(jsonValue),
      });
    });
  });
  return { MetaDatas: metaDatas, Operation: "PUT" };
}
function metadataReaderHandler(e, userId, parentId, token,cNodes, metaOnly){ //handle contents of metadata import document.
    var parsedMeta
    try{
       parsedMeta = JSON.parse(e.target.result) 
    }catch(err){
        console.error("Parsing Error: ",err)
        curateNotification({
            "Title": "Metadata Parsing Error",
            "Text": "Metadata import failed because your import JSON failed to parse correctly.</br>Please review the error message for further details.</br></br>**Error Content**</br>"+err,
            "UserId": userId
        }, token)
        return
    }
    if (metaOnly){
        console.log("ashdahasdh: ", parsedMeta)
        const searchImportNodes = searchNodesWithTokens(token, JSON.stringify(
            {  //search Curate for uploaded nodes
                "NodePaths": parsedMeta.map(obj => (
                   obj.filename.replace("objects/", "")
                ))
            }
        ))
        searchImportNodes
            .then(response => {
                if (response.status !== 200){
                    console.log("Metadata Update Error")
                    curateNotification({
                        "Title": "Metadata Update Error",
                        "Text": "Metadata import failed because there was an error finding your import objects.</br>Please review the error message for further details.</br></br>**Error Content**</br>"+response,
                        "UserId": userId
                    }, token)    
                }else{
                    response.json()
                        .then(rjs => {
                            if (Object.keys(rjs).length == 0){
                                console.log("No Associations Found")
                                curateNotification({
                                    "Title": "No Associations Found",
                                    "Text": "No associations were found in your import document.",
                                    "UserId": userId
                                }, token)
                            }else{
                                var asc
                                try{
                                    console.log("assssss: ", rjs)
                                    asc = associateNodes(parsedMeta,rjs.Nodes)
                                }catch(err){
                                    console.error("Association Error: ",err)
                                    curateNotification({
                                        "Title": "Metadata Association Error",
                                        "Text": "Metadata import failed because there was an eror associating your metadata to its objects.</br>Please review the error message for further details.</br></br>**Error Content**</br>"+err,
                                        "UserId": userId
                                    }, token)
                                    return
                                }
                                if (asc.length == 0){
                                    console.log("No Associations Found")
                                    curateNotification({
                                        "Title": "No Associations Found",
                                        "Text": "No associations were found in your import document.",
                                        "UserId": userId
                                    }, token)
                                    return
                                }
                                const metadatas = convertMetadataArrayToObject(asc)   
                                const url = "https://demo.curate.penwern.co.uk/a/user-meta/update";
                                const authorizationHeader = `Bearer ${token}`;
                                fetch(url, {
                                  method: "PUT",
                                  headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": authorizationHeader
                                  },
                                  body: JSON.stringify(metadatas)
                                })
                                .then(response => {
                                    if (response.status !== 200){
                                        console.error("Metadata Update Error")
                                        curateNotification({
                                            "Title": "Metadata Update Error",
                                            "Text": "Metadata import failed because there was an error updating your metadata.</br>Please review the error message for further details.</br></br>**Error Content**</br>"+response,
                                            "UserId": userId
                                        }, token)
                                        return
                                    }else{
                                        response.json()
                                        .then(rjs =>{ 
                                            console.log("Metadata import detail: ", rjs)
                                            curateNotification({
                                                "Title": "Metadata Import Successful",
                                                "Text": "Metadata import was successful.</br></br>**Update Detail**</br>Updated "+rjs.MetaDatas.length+" metadata fields",
                                                "UserId": userId
                                        }, token) 
                                        }
                                    )
                                    }  
                                })
                                .catch(err => {
                                    console.error("Metadata Update Error: ",err)
                                    curateNotification({
                                        "Title": "Metadata Update Error",
                                        "Text": "Metadata import failed because there was an eror updating your objects metadata.</br>Please review the error message for further details.</br></br>**Error Content**</br>"+err,
                                        "UserId": userId
                                    }, token)
                                });    
                            }
                            
                        })
                }
            })
    }else{
        console.log("yo the rjs now is dis: ", cNodes)
        var asc
        try{
            asc = associateNodes(parsedMeta,cNodes.Nodes,true)
        }catch(err){
            console.log("Association Error: ",err)
            curateNotification({
                "Title": "Metadata Association Error",
                "Text": "Metadata import for [Object] failed because there was an eror associating your metadata to its objects.</br>Please review the error message for further details.</br></br>**Error Content**</br>"+err,
                "UserId": userId,
                "NodeId": parentId
            }, token)
            return
        }
        if (asc.length == 0){
            console.log("No Associations Found")
            curateNotification({
                "Title": "No Associations Found",
                "Text": "Metadata import for [Object] was successful, but no associations were found in your import document.",
                "UserId": userId,
                "NodeId": parentId
            }, token)
            return
        }
        const metadatas = convertMetadataArrayToObject(asc)   
        
        
        const url = "https://demo.curate.penwern.co.uk/a/user-meta/update";
        const authorizationHeader = `Bearer ${token}`;
        fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authorizationHeader
          },
          body: JSON.stringify(metadatas)
        })
        .then(response => {
            if (response.status !== 200){
                console.log("Metadata Update Error")
                curateNotification({
                    "Title": "Metadata Update Error",
                    "Text": "Metadata import for [Object] failed because there was an error updating your uploaded objects metadata.</br>Please review the error message for further details.</br></br>**Error Content**</br>"+response,
                    "UserId": userId,
                    "NodeId": parentId
                }, token)
                return
            }else{
                response.json()
                .then(rjs =>{ 
                    console.log("Metadata import detail: ", rjs)
                    curateNotification({
                        "Title": "Metadata Import Successful",
                        "Text": "Metadata import for [Object] was successful.</br></br>**Update Detail**</br>Updated "+rjs.MetaDatas.length+" metadata fields",
                        "UserId": userId,
                        "NodeId": parentId
                }, token) 
                }
            )
            }  
        })
        .catch(error => {
          console.error(error);
            console.log("Metadata Update Error: ",err)
            curateNotification({
                "Title": "Metadata Update Error",
                "Text": "Metadata import for [Object] failed because there was an eror updating your uploaded objects metadata.</br>Please review the error message for further details.</br></br>**Error Content**</br>"+err,
                "UserId": userId,
                "NodeId": parentId
            }, token)
        });        
    }
    
}
function importMetadata(cF,l,f,type){
    pydio.user.getIdmUser().then(pydUser => pydUser.Uuid) //make sure auth token is fresh
      .then(userId => {
        const token = PydioApi._PydioRestClient.authentications.oauth2.accessToken
        if (type == "userfile"){
          for (const index in f){ //look for a metadata file in the upload
            if (f[index].name == "metadata.json"){
              let reader = new FileReader();
              reader.addEventListener("load", e=> metadataReaderHandler(e,userId,null,token,null,true)) //attach the metadata importer
              reader.readAsText(f[index]) //read the metadata import file
              return
            }
          }
        }
        else if (type =="userfolder"){
          const searchParent = searchNodesWithTokens(token, JSON.stringify({  //search Curate for uploaded nodes
            "NodePaths":[`${getOpenWS()}/${f[0].webkitRelativePath.split("/")[0]}`]
          })) 
          searchParent
            .then(r => r.json())
            .then(rjs => rjs.Nodes[0].Uuid)
            .then(parentId => {
              const jsonBody = generateJson(f)
              const res = searchNodesWithTokens(token, jsonBody)
              res.then(r => r.json())
                .then(rjs => {
                for (const index in f){ //look for a metadata file in the upload
                  if (f[index].name == "metadata.json"){
                    let reader = new FileReader();
                    reader.addEventListener("load", e=> metadataReaderHandler(e,userId,parentId,token,rjs)) //attach the metadata importer
                    reader.readAsText(f[index]) //read the metadata import file
                  }
                }
              })     
            })
        }
    })
}
function longtaskCounter(cF,l,f,type,checksums){
    cF += 1
    if (cF !== l){
        pydio.observeOnce("longtask_finished",()=>{longtaskCounter(cF,l,f,type,checksums)}) //if uploads are still in progress watch the next longtask
    }else{
        
      setTimeout(()=>{ //wait a moment to ensure uploads are finished
          verifyChecksums(checksums)
          if (f.length==1 && f[0].name !== "metadata.json"){
            return
        }
        importMetadata(cF,l,f,type) 
        
      },(10*l)) 
    }
}
function uploadChecksumHandler(e){
  var input = e.target
  if(typeof(Worker) != 'undefined') {
    const fileHashes = []
    Array.from(input.files).forEach(function(file){
      var blob = new Blob([document.querySelector('#hashWorker').textContent]);
      var blobURL = window.URL.createObjectURL(blob);
      var myWorker = new Worker(blobURL);
      console.log('[Main]', 'Init Web Worker');
      myWorker.onmessage = function(event) {
        if (event.data.status == "complete"){
          console.log("hash is: ",event.data.hash)
          fileHashes.push({"file":file,"hash":event.data.hash})
        }
      }
      myWorker.postMessage({file:file, msg:"begin hash"}) 
    })
    console.log("hash array: ", fileHashes)
    return fileHashes
  }else{
    console.log("Browser does not support web-workers. Please update.")
  }   
}
function compareChecksums(objectA, objectB){
    const matches = [];
const fails = []
objectA.Nodes.forEach((nodeA) => {
  const matchingFile = objectB.find(
    (item) =>
      item.file.name.toLowerCase() === JSON.parse(nodeA.MetaStore.name.toLowerCase())
  );

  if (matchingFile && matchingFile.hash === nodeA.Etag) {
    matches.push({
      Uuid: nodeA.Uuid,
      Path: nodeA.Path,
      Etag: nodeA.Etag,
      Hash: matchingFile.hash,
    });
  }else if(matchingFile){
      fails.push({
          Uuid: nodeA.Uuid,
          Path: nodeA.Path,
          Etag: nodeA.Etag,
          Hash: matchingFile.hash,
      })
  }
});

return {"matches":matches, "fails":fails};
}
function verifyChecksums(checksums){
  pydio.user.getIdmUser().then(pydUser => pydUser.Uuid) //make sure auth token is fresh
    .then(userId => {
       return PydioApi._PydioRestClient.authentications.oauth2.accessToken
    })
    .then(token => {
        var userId = pydio.user.idmUser.Uuid
         const transformedObject = {
  NodePaths: checksums.map((item) => 

    item.file.webkitRelativePath !== ""
      ? getOpenWS()+"/"+item.file.webkitRelativePath
      : getOpenWS()+"/"+item.file.name
  ),
};
    const searchNodes = searchNodesWithTokens(token, JSON.stringify(transformedObject)) 
    searchNodes
        .then(r => r.json())
        .then(rjs => {
            const comparison = compareChecksums(rjs, checksums)
            console.log("Nodes: ", rjs)
            console.log("Checksums: ", checksums)
            console.log("Comparison: ", comparison)
            
            if (comparison.fails.length == 0 && comparison.matches.length == checksums.length){
                console.log("Checksum report, no errors: ",comparison.matches.length, " files were successfully verified, no issues were found. Please review the output object for more detail: ", comparison)
                curateNotification({
                    "Title": "Checksum Report",
                    "Text": comparison.matches.length + " Files were successfully verified. No issues were found.",
                    "UserId": userId
                }, token)
            }else if(comparison.fails.length == 0 && comparison.matches.length !== checksums.length){
                console.log("Checksumming error, could not generate checksums for all files")
                curateNotification({
                    "Title": "Checksum Report",
                    "Text": "Checksumming error, could not generate checksums for all files.</br>Please review the developer console for further details.",
                    "UserId": userId
                }, token)
            }else if(comparison.fails.length !== 0){
                console.log("Checksum report, issues found: ", comparison.fails.length, " files had inconsistent checksums. Check the output object for more detail: ", comparison.fails)
                curateNotification({
                    "Title": "Checksum Report",
                    "Text": comparison.fails.length + " files had inconsistent checksums. Please review the developer console for further details.",
                    "UserId": userId
                }, token)
            }
        })   
    })
    
            
}
document.addEventListener("input",function(e){    
    let t = e.target
    if (t.name !== "userfile" && t.name !== "userfolder"){ //if the input isn't an upload do nothing
        return
    }else{
        const checksums = uploadChecksumHandler(e)
        
        const f = {...t.files}
        let l = t.files.length
        let cF = 0
        let s = 0
        pydio.observeOnce("longtask_finished",()=>{longtaskCounter(cF,l,f,t.name,checksums)}) //begin watching the upload tasks and process import when finished
    }
})