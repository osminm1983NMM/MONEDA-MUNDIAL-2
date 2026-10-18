// Research interface only. No provider agreements or live financial routes.
import React,{useState} from 'react';
import {View,Text,TouchableOpacity,TextInput,Share,Linking,Alert} from 'react-native';
import {searchWorldResearchCountries,getWorldResearchCountry} from './src/digital-money/worldwide-research-countries.mjs';
import {getMobileProviderOutreachDraft} from './src/digital-money/mobile-provider-outreach.mjs';
import {getProviderResearchCopy} from './src/digital-money/provider-research-copy.mjs';
import {RESEARCH_DESTINATIONS} from './src/digital-money/project-launch-status.mjs';
import {getProviderResearchOverview,RESEARCH_PAYOUTS} from './src/digital-money/provider-research-overview.mjs';

const style={panel:{backgroundColor:'#142e45',borderRadius:12,padding:14,marginVertical:8},
 text:{color:'#dfedf6',marginVertical:5},alert:{color:'#ffdc97',marginVertical:8},
 btn:{backgroundColor:'#284c6a',padding:10,borderRadius:7,marginVertical:3}};

export default function ProviderResearchScreen({language='es'}){
 const ui=getProviderResearchCopy(language);
 const [destination,setDestination]=useState('HN');
 const [method,setMethod]=useState('bank_account');
 const [countrySearch,setCountrySearch]=useState('');
 const [catalogueCode,setCatalogueCode]=useState(null);
 const chosen=catalogueCode?getWorldResearchCountry(catalogueCode,language):null;
 const result=getProviderResearchOverview({destination,method});
 const shareDraft=async providerId=>{
  const draft=getMobileProviderOutreachDraft({providerId,destination});
  if(!draft)return;
  // Share opens the OS share-sheet: the user must review and send manually.
  try{await Share.share({message:draft.message,title:draft.subject});}
  catch{Alert.alert(ui.shareErrorTitle,ui.shareError);}
 };
 const openOfficialForm=async providerId=>{
  const draft=getMobileProviderOutreachDraft({providerId,destination});
  if(!draft)return;
  // Approved HTTPS URLs come from the internal catalogue, never user input.
  try{await Linking.openURL(draft.contactUrl);}
  catch{Alert.alert(ui.browserErrorTitle,ui.browserError);}
 };
 return <View style={style.panel}>
  <Text style={{color:'#fff',fontSize:20,fontWeight:'800'}}>{ui.title}</Text>
  <Text style={style.alert}>{ui.warning}</Text>
  <Text style={style.text}>{ui.destination}</Text>
  {Object.entries(RESEARCH_DESTINATIONS).map(([code,c])=>
   <TouchableOpacity accessibilityRole="button" key={code} style={style.btn} onPress={()=>setDestination(code)}>
    <Text style={style.text}>{destination===code?'✓ ':''}{getWorldResearchCountry(code,language)?.name||c.country} ({code})</Text>
   </TouchableOpacity>)}
  <Text style={style.text}>{ui.countries}</Text>
  <TextInput accessibilityLabel={ui.searchLabel} value={countrySearch}
   onChangeText={setCountrySearch} maxLength={80} autoCorrect={false}
   placeholder={ui.searchPlaceholder} placeholderTextColor="#b9cfe1"
   style={{backgroundColor:'#284c6a',color:'#fff',padding:10,borderRadius:8}}/>
  {searchWorldResearchCountries(countrySearch,12,language).map(c=>
   <TouchableOpacity key={c.code} style={style.btn} accessibilityRole="button" onPress={()=>setCatalogueCode(c.code)}>
    <Text style={style.text}>{catalogueCode===c.code?'✓ ':''}{c.name} ({c.code}) · {ui.research}</Text>
   </TouchableOpacity>)}
  {chosen&&<Text style={style.alert}>{chosen.name} ({chosen.code}): {ui.countryNotice}</Text>}
  <Text style={style.text}>{ui.payoutMethod}</Text>
  {Object.keys(RESEARCH_PAYOUTS).map(id=>
   <TouchableOpacity accessibilityRole="button" key={id} style={style.btn} onPress={()=>setMethod(id)}>
    <Text style={style.text}>{method===id?'✓ ':''}{ui.methods[id]}</Text>
   </TouchableOpacity>)}
  {result&&<View>
   <Text style={style.text}>{ui.route}{getWorldResearchCountry(destination,language)?.name||result.country}</Text>
   <Text style={style.alert}>{ui.confirmed}: {result.confirmedProviders} · {ui.real}</Text>
   {result.candidates.map(p=><View key={p.providerId} style={style.btn}>
    <Text style={{color:'#fff',fontWeight:'700'}}>{p.name}</Text>
    <Text style={style.text}>{ui.studies[p.providerId]||p.study}</Text>
    <Text style={style.text}>{ui.investigate}: {p.candidateMethodInResearch?ui.yes:ui.no}</Text>
    <Text style={style.text}>{ui.documents}: {p.documentationMissing} / {p.documentationRequired}</Text>
    <Text style={style.alert}>{ui.coverage}</Text>
    {destination==='HN'&&<View>
     <Text style={style.text}>{ui.mobile}</Text>
     <TouchableOpacity accessibilityRole="button" accessibilityLabel={ui.shareLabel+p.name}
      style={style.btn} onPress={()=>shareDraft(p.providerId)}>
      <Text style={style.text}>{ui.share} · {p.name}</Text>
     </TouchableOpacity>
     <TouchableOpacity accessibilityRole="button" accessibilityLabel={ui.openLabel+p.name}
      style={style.btn} onPress={()=>openOfficialForm(p.providerId)}>
      <Text style={style.text}>{ui.open} · {p.name}</Text>
     </TouchableOpacity>
     <Text style={style.alert}>{ui.noSend}</Text>
    </View>}
   </View>)}
   <Text style={style.alert}>{ui.nextAction}</Text>
  </View>}
  <Text style={style.alert}>{ui.footer}</Text>
 </View>;
}
