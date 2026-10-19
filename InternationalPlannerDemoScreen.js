import React,{useState} from 'react';
import {View,Text,TextInput,StyleSheet,TouchableOpacity} from 'react-native';
import {buildInternationalDemoPlan,DEMO_PAYOUT_METHODS} from './src/digital-money/international-demo-planner.mjs';
import {searchCountryOptionsDemo} from './src/digital-money/country-search-demo.mjs';
import {buildBeneficiaryVerificationChecklistDemo} from './src/digital-money/beneficiary-verification-checklist-demo.mjs';
import {assessInternationalProviderCandidateDemo} from './src/digital-money/international-provider-assessment-demo.mjs';
import {detectInternationalDemoLanguage,INTERNATIONAL_DEMO_TEXT,internationalRequirementText,internationalCheckText,internationalProviderCheckText} from './src/digital-money/international-demo-i18n.mjs';
import {resolveInternationalDemoLanguage} from './src/digital-money/international-demo-language-preference.mjs';
const s=StyleSheet.create({box:{backgroundColor:'#13253e',borderRadius:12,padding:16,marginTop:10},heading:{color:'#fff',fontSize:19,fontWeight:'bold',marginBottom:10},text:{color:'#d4e0f1',marginBottom:8},notice:{color:'#ffda88',marginBottom:10},input:{backgroundColor:'#243957',color:'white',padding:12,borderRadius:8,marginBottom:10}});
export default function InternationalPlannerDemoScreen({languagePreference='auto',languageReady=true,onLanguageChange}){
 // El estado vive en App: cambiar idioma aquí actualiza también la portada.
 const [deviceLanguage]=useState(detectInternationalDemoLanguage);
 const language=resolveInternationalDemoLanguage(languagePreference,deviceLanguage);
 const t=INTERNATIONAL_DEMO_TEXT[language];
 const [origin,setOrigin]=useState('US');
 const [destination,setDestination]=useState('HN');
 const [amount,setAmount]=useState('25.00');
 const [method,setMethod]=useState('bank_account');
 const [countrySearch,setCountrySearch]=useState('');
 const plan=buildInternationalDemoPlan({originCode:origin,destinationCode:destination,amountUSD:amount,payoutMethod:method});
 const verification=buildBeneficiaryVerificationChecklistDemo(plan);
 const providerAssessment=assessInternationalProviderCandidateDemo(plan);
 return <View style={s.box}>
  <Text style={s.heading}>{t.title}</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',marginBottom:8}}>{['auto','es','en'].map(lang=><TouchableOpacity
    key={lang} accessibilityRole="button" disabled={!languageReady||typeof onLanguageChange!=='function'}
    onPress={()=>onLanguageChange(lang)}
    style={[s.input,{marginRight:8},languagePreference===lang&&{borderColor:'#ffda88',borderWidth:1}]}>
    <Text style={s.text}>{lang==='auto'?'Auto':lang==='es'?'Español':'English'}</Text>
  </TouchableOpacity>)}</View>
  <Text style={s.notice}>{t.notice}</Text>
  <Text style={s.text}>{t.favorites}</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',marginBottom:10}}>
   {searchCountryOptionsDemo('',12).filter(v=>v.code!=='US').map(v=>
    <TouchableOpacity key={v.code} accessibilityRole="button"
      onPress={()=>setDestination(v.code)} style={{backgroundColor:'#243957',padding:9,borderRadius:8,marginRight:6,marginBottom:6}}>
     <Text style={s.text}>{v.name}</Text>
    </TouchableOpacity>
   )}
  </View>
  <Text style={s.text}>{t.search}</Text>
  <TextInput accessibilityLabel="Buscar país de destino" style={s.input}
    autoCorrect={false} value={countrySearch} onChangeText={setCountrySearch}
    placeholder={t.searchPlaceholder} placeholderTextColor="#b3c5d9" />
  {!!countrySearch.trim()&&searchCountryOptionsDemo(countrySearch,25).map(v=>
    <TouchableOpacity key={v.code} accessibilityRole="button" style={s.input}
      onPress={()=>{setDestination(v.code);setCountrySearch('');}}>
      <Text style={s.text}>{v.label}</Text>
    </TouchableOpacity>)}
  <Text style={s.text}>{t.origin}</Text>
  <TextInput accessibilityLabel="País origen" style={s.input} autoCapitalize="characters" maxLength={2} value={origin} onChangeText={setOrigin}/>
  <Text style={s.text}>{t.destination}</Text>
  <TextInput accessibilityLabel="País destino" style={s.input} autoCapitalize="characters" maxLength={2} value={destination} onChangeText={setDestination}/>
  <Text style={s.text}>{t.amount}</Text>
  <TextInput accessibilityLabel="Importe simulado USD" style={s.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount}/>
  <Text style={s.heading}>{t.methods}</Text>
  {DEMO_PAYOUT_METHODS.map(m=><TouchableOpacity key={m.id} accessibilityRole="button" onPress={()=>setMethod(m.id)}
    style={[s.input,method===m.id&&{borderWidth:1,borderColor:'#ffda88'}]}>
    <Text style={s.text}>{method===m.id?'◉':'○'} {t.methodNames[m.id]}</Text>
  </TouchableOpacity>)}
  {!plan?<Text style={s.notice}>{t.invalid}</Text>:<>
   <Text style={s.text}>{t.route}: {plan.originCode} → {plan.destinationCode}</Text>
   <Text style={s.text}>{t.amountShown}: {(plan.amountCents/100).toFixed(2)} USD</Text>
   <Text style={s.text}>{t.delivery}: {t.methodNames[plan.payoutMethod]}. {t.beneficiaryPending}</Text>
   <Text style={s.notice}>{t.disabled}</Text>
   <Text style={s.heading}>{t.requirements}</Text>
   {plan.requirements.map((line,index)=><Text key={index} style={s.text}>• {internationalRequirementText(language,plan.requirements,plan.payoutMethod,index)}</Text>)}
   <Text style={s.heading}>{t.beneficiary}</Text>
   {verification?.checklist.map(item=><Text key={item.id} style={s.text}>○ {internationalCheckText(language,item)} — {t.awaiting}</Text>)}
   <Text style={s.heading}>{t.provider}</Text>
   <Text style={s.notice}>{t.noProvider}</Text>
   {providerAssessment?.missing.map(item=><Text style={s.text} key={item.id}>○ {internationalProviderCheckText(language,item)} — {t.unverified}</Text>)}
   <Text style={s.notice}>{t.privacy}</Text>
  </>}
 </View>;
}
