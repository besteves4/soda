import { useState } from "react";
import { useSession } from "@inrupt/solid-ui-react";

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

import {
  createSolidDataset,
  createThing,
  getThing,
  setThing,
  addUrl,
  addStringNoLocale,
  buildThing,
  saveSolidDatasetAt,
  getPodUrlAll,
  getSolidDataset,
  getContainedResourceUrlAll,
} from "@inrupt/solid-client";
import { RDF, ODRL, DCAT, DCTERMS } from "@inrupt/vocab-common-rdf";
import { fetch } from "@inrupt/solid-client-authn-browser";

async function getPolicyFilenames(policiesContainer) {
  const myDataset = await getSolidDataset(policiesContainer.href, {
    fetch: fetch,
  });

  const policyList = getContainedResourceUrlAll(myDataset);
  return policyList;
}

async function getDatasetCatalog(catalogURL, policyURL, publisherURL, datasetURL, dataType, purpose) {
  let catalog = await getSolidDataset(catalogURL, {
    fetch: fetch,
  });

  const dataset = buildThing(createThing({ name: `dataset-${policyURL.split('/').pop()}` }))
    .addUrl(RDF.type, DCAT.Dataset)
    .addUrl(ODRL.hasPolicy, policyURL)
    .addUrl(DCTERMS.publisher, publisherURL)
    .addUrl("https://w3id.org/dpv#hasLocation", datasetURL)
    .addUrl("https://w3id.org/dpv#hasPersonalData", `https://w3id.org/dpv/dpv-pd#${dataType}`)
    .addUrl("https://w3id.org/dpv#hasPurpose", `https://w3id.org/dgaterms#${purpose}`)
    .addStringNoLocale(DCTERMS.description, `Dataset of ${dataType} to be used to ${purpose}`)
    .build();
  catalog = setThing(catalog, dataset);

  let catalogThing = getThing(catalog, catalogURL);
  catalogThing = buildThing(catalogThing)
    .addInteger(DCAT.dataset, `${catalogURL}#dataset-${policyURL.split('/').pop()}`)
    .build();
  catalog = setThing(catalog, catalogThing);

  return catalog;
}

const altruisticPurpose = [
  { value: "CombatClimateChange", label: "Combat Climate Change" },
  { value: "ScientificResearch", label: "Scientific Research" },
  { value: "ImproveHealthcare", label: "Improve Healthcare" },
  { value: "ImprovePublicServices", label: "Improve Public Services" },
  { value: "ImproveTransportMobility", label: "Improve Transport and Mobility" },
  { value: "ProvideOfficialStatistics", label: "Provide Official Statistics" },
  { value: "PublicPolicyMaking", label: "Public Policy Making" },
];

const dataTypes = [
  { value: "Location", label: "Location" },
  { value: "Health", label: "Health" },
  { value: "Age", label: "Age" },
  { value: "EducationQualification", label: "Education Qualification" },
  { value: "VehicleUsage", label: "Vehicle Usage" },
];

export function Editor() {
  const { session, sessionRequestInProgress } = useSession();

  const dga = "https://w3id.org/dgaterms#"
  const dpv = "https://w3id.org/dpv#" ;
  const oac = "https://w3id.org/oac#" ;

  const [chosenPurpose, setChosenPurpose] = useState(altruisticPurpose[0].value);
  const [chosenData, setChosenData] = useState(dataTypes[0].value);
  const [dataStorage, setDataStorage] = useState(session.info.webId.split("profile")[0]);
  const [policyStorage, setPolicyStorage] = useState("policy-x");

  const [display, setDisplay] = useState(false);
  const [displayBtn, setDisplayBtn] = useState(false);
  const [displayResource, setDisplayResource] = useState("");
  const [displayData, setDisplayData] = useState("");
  const [displayPolicy, setDisplayPolicy] = useState("");
  const [displayPurpose, setDisplayPurpose] = useState("");

  const generatePolicy = () => {
    // TODO: chosenPolicy/selectedPD/selectedPurpose have to be gathered only when generatePolicy is activated
    //console.log(session);
    let newPolicy = createSolidDataset();

    let policy = createThing({ name: "policy1" });
    let permission = createThing({ name: "permission1" });
    policy = addUrl(policy, RDF.type, ODRL.Offer);
    policy = addUrl(policy, ODRL.permission, permission);
    newPolicy = setThing(newPolicy, policy);

    permission = addUrl(permission, ODRL.target, dataStorage);
    permission = addUrl(permission, `${dpv}hasPersonalData`, `${dpv}${chosenData}`);
    permission = addUrl(permission, ODRL.action, `${oac}Read`);
    permission = addUrl(permission, ODRL.assigner, session.info.webId);
    let purposeConstraint = createThing({ name: "purposeConstraint" });
    permission = addUrl(permission, ODRL.constraint, purposeConstraint);
    newPolicy = setThing(newPolicy, permission);

    purposeConstraint = addUrl(purposeConstraint, ODRL.leftOperand, `${oac}Purpose`);
    purposeConstraint = addUrl(purposeConstraint, ODRL.operator, ODRL.isA);
    purposeConstraint = addUrl(purposeConstraint, ODRL.rightOperand, `${dga}${chosenPurpose}`);
    newPolicy = setThing(newPolicy, purposeConstraint);

    getPodUrlAll(session.info.webId).then((response) => {
      if (chosenPurpose === "") {
        alert("Choose the purpose of policy");
      } else if (chosenData === "") {
        alert("Choose the categories of personal data available in the resource");
      } else if (dataStorage === "") {
        alert("Indicate the URL of the resource");
      } else if (policyStorage === "") {
        alert("Choose a name for the file storing the policy");
      } else {
        const podRoot = response[0];
        // TODO: check if ```policiesContainer``` exists before using it as a path to store policies
        const policiesContainer = "altruism/";
        const podPoliciesContainer = new URL(policiesContainer, podRoot);
        const filename = policyStorage;

        const filenameContainer = `${policiesContainer}${filename}`;
        const filenameSave = new URL(filenameContainer, podRoot);
        
        getPolicyFilenames(podPoliciesContainer).then((policyList) => {
          if (policyList.includes(filenameSave.href)) {
            alert("There is already a policy with that name, choose another");
          } else {
            try {

              saveSolidDatasetAt(filenameSave.href, newPolicy, {
                fetch: fetch,
              });
              setDisplayPolicy(filenameSave.href);
              setDisplayResource(dataStorage);
              setDisplayData(chosenData);
              setDisplayPurpose(chosenPurpose);
              setDisplay(true);
              setDisplayBtn(true);
            } catch (error) {
              console.log(error);
            }
          }
        });
      }
    });
  };

  const shareWithSoDACompany = () => { 
    const catalogURL = "https://solidweb.me/soda/catalogs/catalog1";
    
    getPodUrlAll(session.info.webId).then((response) => {

      const podRoot = response[0];
      const policyURL = `${podRoot}altruism/${policyStorage}`;

      getDatasetCatalog(catalogURL, policyURL, session.info.webId, dataStorage, chosenData, chosenPurpose).then((catalog) => {
        try {
          saveSolidDatasetAt(
            catalogURL,
            catalog,
            { fetch: fetch }
          );
          alert("Availability of dataset sent to data altruism organisation");
        } catch (error) {
          console.log(error);
        }
      })
    })
  };

  if (sessionRequestInProgress) {
    return null;
  };

  return (
    <div className="row">
      <div className="left-col">
        <div className="container">
          <div className="">
            <p>
              <b>Indicate the URL of the resource to share:</b>
            </p>
            <TextField
              size="medium"
              onChange={(ev) => setDataStorage(ev.target.value)}
              value={dataStorage}
            />
          </div>
        </div>
        <div className="container">
          <div className="">
            <p>
              <b>Choose type of data present in the resource:</b>
            </p>
            <FormControl fullWidth>
              <InputLabel id="policy-type-label" htmlFor="policy-type-select">
                Data Type
              </InputLabel>
              <Select
                size="small"
                labelId="policy-type-label"
                id="policy-type-select"
                label="Data Type"
                onChange={(ev) => setChosenData(ev.target.value)}
                value={chosenData}
              >
                {dataTypes.map((data) => (
                  <MenuItem key={data.value} value={data.value}>
                    {data.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </div>
        <div className="container">
          <div className="">
            <p>
              <b>Choose purpose for altruistic reuse:</b>
            </p>
            <FormControl fullWidth>
              <InputLabel id="policy-type-label" htmlFor="policy-type-select">
                Purpose
              </InputLabel>
              <Select
                size="small"
                labelId="policy-type-label"
                id="policy-type-select"
                label="Purpose"
                onChange={(ev) => setChosenPurpose(ev.target.value)}
                value={chosenPurpose}
              >
                {altruisticPurpose.map((purpose) => (
                  <MenuItem key={purpose.value} value={purpose.value}>
                    {purpose.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </div>
        <div className="container">
          <div className="bottom-input">
            <p>
              <b>Policy name:</b>
            </p>
            <TextField
              size="small"
              onChange={(ev) => setPolicyStorage(ev.target.value)}
              value={policyStorage}
            />
          </div>
          <div className="bottom-container">
            <Button variant="small" value="permission" onClick={generatePolicy}>
              Generate & Store in the Pod
            </Button>
            <br></br>
            <br></br>
            {
              displayBtn && (
                <Button variant="small" value="permission" onClick={shareWithSoDACompany}>
                  Send to Data Altruism Organisation
                </Button>
              )
            }
          </div>
        </div>
      </div>
      <div className="right-col">
        {display && (
          <pre>{`
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
            PREFIX dpv: <${dpv}> 
            PREFIX oac: <${oac}>
            PREFIX dga: <${dga}>            

            <${displayPolicy}>
                rdf:type odrl:Offer ;
                odrl:profile oac: ;
                odrl:permission [
                    odrl:assigner <${session.info.webId}> ;
                    odrl:action oac:Read ;
                    dpv:hasPersonalData dpv:${displayData} ;
                    odrl:target <${displayResource}> ;
                    odrl:constraint [
                        odrl:leftOperand oac:Purpose ;
                        odrl:operator odrl:isA ;
                        odrl:rightOperand dga:${displayPurpose}
                    ]
                ] .
          `}</pre>
        )}
      </div>
    </div>
  );
}
