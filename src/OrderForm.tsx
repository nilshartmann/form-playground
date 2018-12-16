import React from "react";
import ErrorDisplay from './form/errorDisplay';

// UI (independent from useForm hook)
import { Input } from "./form/Input";

// Form Logic
import { ValidateFn, useForm, Form, ValueCreators, MultiFormInput, RecordError, ValidateAsync, AsyncValidatorFunction, CustomObjectInput } from "./form/useForm";

interface Drink {
  name: string;
  size: string;
}

interface OrderFormState {
  vorname: string;
  nachname: string;
  plz: string;
  drinks: Drink[];
  pizzen: Pizza[];
}

interface Pizza {
  groesse: number;
  belaege: string[];
}
const plzCache: string[] = [];
const invalidPlzCache: string[] = [];
// validatePizzaForm jetzt "kontextlos", dh zum Beispiel von außen testbar
const validatePizzaForm: ValidateFn<OrderFormState> = function (
  newFormInput,
  isVisited,
  recordError: RecordError<OrderFormState>,
  validateDelayed: ValidateAsync<OrderFormState>
) {
  if (isVisited("vorname") && newFormInput.vorname.length < 3) {
    recordError("vorname", "Der Vorname muss mindestens 3 Zeichen lang sein");
  }

  if (isVisited("nachname") && newFormInput.nachname.length < 3) {
    recordError("nachname", "Der Nachname muss mindestens 3 Zeichen lang sein");
  }

  if (isVisited("vorname") && isVisited("nachname")) {
    if (newFormInput.vorname.length >= newFormInput.nachname.length) {
      recordError("nachname", "Vorname muss kürzer als Nachname sein");
    }
  }
  if (isVisited('plz') && newFormInput.plz.length < 5) {
    recordError("plz", "Postleitzahlen müssen fünf Ziffern haben", true);
  } else {
    if (isVisited('plz') && invalidPlzCache.indexOf(newFormInput.plz) !== -1) {
      recordError("plz", "Postleitzahl nicht im Liefergebiet", true);
    } else if (isVisited('plz') && plzCache.indexOf(newFormInput.plz) === -1) {
      const validation: AsyncValidatorFunction<OrderFormState> = (currentValue, errorRecorder) => {
        if (currentValue.plz === newFormInput.plz) {
          if (['22305', '22159', '22761', '22222'].indexOf(newFormInput.plz) === -1) {
            errorRecorder("plz", "Postleitzahl nicht im Liefergebiet", true);
            invalidPlzCache.push(newFormInput.plz);
          } else {
            plzCache.push(newFormInput.plz);
          }
        }
      }
      validateDelayed(new Promise((res, rej) => window.setTimeout(() => res(validation), 5000)), 'plz');
    }
  }


  if (isVisited('pizzen') && newFormInput.pizzen.length === 0) {
    recordError('pizzen', 'Es muss mindestens eine Pizza bestellt werden');
  }
  newFormInput.pizzen.forEach((pizza, idx) => {
    if (isVisited(`pizzen[${idx}].groesse`) && pizza.groesse > 50) {
      recordError(`pizzen[${idx}].groesse`, 'Eine Pizza darf maximal 50 cm groß sein');
    }
  });

}
const initialValues: OrderFormState = {
  vorname: "test",
  nachname: "",
  plz: "",
  pizzen: [],
  drinks: []
};
const valueCreators: ValueCreators<OrderFormState> = {
  pizzen: () => { return { groesse: 60, belaege: [] } }
}


export default function OrderForm() {
  function submit() {
    console.log("submitting", overallFormState.values);
  }

  const [overallFormState, form] = useForm<OrderFormState>(validatePizzaForm, initialValues, submit, valueCreators);
  const { input, multi, custom } = form;

  return (
    <div className="Form">
      <Input label="Vorname" {...input('vorname')} />
      <Input label="Nachname" {...input('nachname')} />
      <Input label="PLZ" {...input('plz')} />
      <button onClick={() => overallFormState.setValue("plz", "")}>
        Clear PLZ
      </button>
      <DrinksEditor {...custom('drinks')} />
      <MultiPizzaEditor {...multi('pizzen')} />
      <button disabled={overallFormState.hasErrors} onClick={overallFormState.handleSubmit} >
        Bestellen !
      </button>
      <button onClick={() => console.log(overallFormState.values)}>
        Show Form State
      </button>
    </div>
  );
}

const drinks: Drink[] = [
  { name: 'FritzCola', size: 'klein' },
  { name: 'FritzCola', size: 'mittel' },
  { name: 'Wasser', size: 'klein' },
  { name: 'Wasser', size: 'groß' },
  { name: 'Bier', size: 'groß' },

];
function DrinksEditor(props: CustomObjectInput<Drink[]>) {
  const remove = (idx: number) => {
    return props.value.filter((d, i) => i !== idx);
  }
  const add = (drink: Drink) => {
    return props.value.concat(drink);
  }

  return <div className='drinksEditor'>
    <div>Getränke hinzufügen</div>
    {drinks.map((d, idx) =>
      <div key={idx} onClick={() => props.onValueChange(add(d))} className="drinkSelect">
        {d.name} ({d.size})
        </div>
    )}
    <div>Gewünschte Getränke</div>
    {props.value.map((d: Drink, idx: number) =>
      <li key={idx}>
        <span className='drinksDisplay' >{d.name} ({d.size})</span>
        <button onClick={() => props.onValueChange(remove(idx))}>x</button>
      </li>
    )}
  </div>
}



const alleBelaege = ["Oliven", "Feta", "Zwiebeln", "Mais", "Pilze"];
function BelagEditor(props: CustomObjectInput<string[]>) {
  const remove = (idx: number) => {
    return props.value.filter((d, i) => i !== idx);
  }
  const add = (belag: string) => {
    return props.value.concat(belag);
  }

  return <div className='drinksEditor'>
    <div>Beläge hinzufügen</div>
    {alleBelaege.map((d, idx) =>
      <div key={idx} onClick={() => props.onValueChange(add(d))} className="drinkSelect"> {d}  </div>
    )}
    <div>Gewünschte Beläge</div>
    {props.value.map((d: string, idx: number) =>
      <li key={idx}><span className='drinksDisplay' >{d} </span> <button onClick={() => props.onValueChange(remove(idx))}>x</button></li>
    )}
  </div>
}



function MultiPizzaEditor(props: MultiFormInput<Pizza>) {
  return <div>
    {
      props.value.map((pi: Pizza, idx: number) =>
        <div key={idx}>
          <PizzaEditor {...props.subEditorProps(pi, idx)} />
          <button onClick={() => props.onRemove(idx)} >entfernen</button>
        </div>
      )
    }
    <ErrorDisplay errorMessages={props.errorMessages} />
    <button onClick={() => props.onAdd()}>Pizza hinzufügen</button>
  </div>
}

function PizzaEditor(props: Form<Pizza>) {
  return <div>
    <Input label="Größe" {...props.input('groesse')} />
    <BelagEditor {...props.custom('belaege')} />
  </div>
}



