import React from "react";
import ErrorDisplay from './form/errorDisplay';

// UI (independent from useForm hook)
import { Input } from "./form/Input";
import { isEqual } from "lodash";

// Form Logic
import { ValidateFn, useForm, Form, ValueCreators, MultiFormInput, RecordError, RecordErrorAsync, CustomObjectInput, ParentFormAdapter } from "./form/useForm";

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
  pizzadetails: {};
}
const plzCache: string[] = [];
const invalidPlzCache: string[] = [];
// validatePizzaForm jetzt "kontextlos", dh zum Beispiel von außen testbar
const validatePizzaForm: ValidateFn<OrderFormState> = function (
  newFormInput,
  recordError: RecordError<OrderFormState>,
  recordErrorAsync: RecordErrorAsync<OrderFormState>
) {
  if (newFormInput.vorname.length < 3) {
    recordError("vorname", "Der Vorname muss mindestens 3 Zeichen lang sein");
  }

  if (newFormInput.nachname.length < 3) {
    recordError("nachname", "Der Nachname muss mindestens 3 Zeichen lang sein");
  }

  if (newFormInput.vorname.length >= newFormInput.nachname.length) {
    recordError("nachname", "Vorname muss kürzer als Nachname sein");
  }
  if (newFormInput.plz.length != 5) {
    recordError("plz", "Postleitzahlen müssen fünf Ziffern haben", true);
  } else {
    if (invalidPlzCache.indexOf(newFormInput.plz) !== -1) {
      recordError("plz", "Postleitzahl nicht im Liefergebiet (cached)", true);
    } else if (plzCache.indexOf(newFormInput.plz) === -1) {
      const durationString = newFormInput.plz.charAt(4);
      const duration: number = (/[0-9]{1}/.test(durationString) ? +durationString : 5) * 1000;

      const validation = async () => {
        //        let fakeResponse = !newFormInput.plz.startsWith('22');
        let fakeResponse = ['22305', '22159', '22300', '22761', '22222'].indexOf(newFormInput.plz) === -1;

        let invalid = await fetchMock(fakeResponse, duration);
        if (invalid) {
          invalidPlzCache.push(newFormInput.plz);
          return "Postleitzahl nicht im Liefergebiet";
        } else {
          plzCache.push(newFormInput.plz);
          return null;
        }
      }

      recordErrorAsync("plz", validation());


    }
  }

  if (newFormInput.pizzen.length === 0) {
    recordError('pizzen', 'Es muss mindestens eine Pizza bestellt werden');
  }
  /*  newFormInput.pizzen.forEach((pizza, idx) => {
      if (isVisited(`pizzen[${idx}].groesse`) && pizza.groesse > 50) {
        recordError(`pizzen[${idx}].groesse`, 'Eine Pizza darf maximal 50 cm groß sein');
      }
    });
  */
}


function fetchMock<T>(response: T, timeout: number): Promise<T> {
  console.log('simulating an answer in ' + timeout + ' ms');
  return new Promise((res) => window.setTimeout(() => res(response), timeout));
}

const initialValues: OrderFormState = {
  vorname: "test",
  nachname: "",
  plz: "",
  pizzen: [],
  drinks: []
};
const valueCreators: ValueCreators<OrderFormState> = {
  pizzen: () => { return { groesse: 5001, belaege: [] } }
}

interface OrderFormProps {
  submit: (values: OrderFormState) => void;
}

export default function OrderForm(props: OrderFormProps) {
  const [overallFormState, form] = useForm<OrderFormState>('order form', validatePizzaForm, initialValues, props.submit, valueCreators);
  const { input, multi, custom } = form;
  return  (
    <div className="Form">
      <Input label="Vorname" {...input('vorname')} />
      <Input label="Nachname" {...input('nachname')} />
      <Input label="PLZ" {...input('plz')} />
      <button onClick={() => overallFormState.setValue("plz", "")}>
        Clear PLZ
      </button>
      <DrinksEditor {...custom('drinks')} />
      <button onClick={() => console.log(overallFormState.values)}>
        Show Form State
      </button>
      <MultiPizzaEditor {...multi('pizzen')} />
      <button disabled={ overallFormState.submitRequested && overallFormState.hasErrors} onClick={overallFormState.handleSubmit} >
        Bestellen !
      </button>
    </div>
  );
}



function MultiPizzaEditor(props: MultiFormInput<Pizza>) {
  return <div>
    <button onClick={() => props.onAdd()}>Pizza hinzufügen</button>
    {
      props.value.map((pi: Pizza, idx: number) =>
        <MemoPizzaEditor initialValue={pi} parentForm={props.getParentFormAdapter(idx)} key={idx} count={props.value.length} id={idx} onRemove={props.onRemove} />
      )
    }
    <ErrorDisplay visited={props.visited} errorMessages={props.errorMessages} />
  </div>
}
const validatePizza: ValidateFn<Pizza> = (newValues,
  recordError: RecordError<Pizza>,
  recordErrorDelayed: RecordErrorAsync<Pizza>) => {
  if (newValues.groesse > 5000) {
    recordError('groesse', 'Eine Pizza darf maximal 50 cm groß sein');
  }
}

interface PizzaEditorProps {
  parentForm: ParentFormAdapter,
  id: number,
  count: number,
  onRemove: (idx: number) => void,
  initialValue: Pizza
}
function PizzaEditor(props: PizzaEditorProps) {
  const [overallFormState, form] = useForm<Pizza>('pizzaForm', validatePizza, props.initialValue, () => { }, {}, props.parentForm);
  const { input, multi, custom } = form;
  return <div>
    <Input label="Größe" {...input('groesse')} />
    <BelagEditor {...custom('belaege')} />
    <PizzaDetailsEditor parentForm={form.getParentFormAdapter('pizzadetails')} />

    <button onClick={() => props.onRemove(props.id)} >entfernen</button>

  </div>
}

interface PizzaDetailsProps {
  parentForm: ParentFormAdapter;
}
interface PizzaDetails {
  sauce: string;
  gutscheincode: string;
  nochwas: string;
}
async function validatePizzaDetails(newValues: PizzaDetails,
  recordError: RecordError<PizzaDetails>,
  recordErrorDelayed: RecordErrorAsync<PizzaDetails>) {
    if (newValues.nochwas.length > 0) {
      const validation = async () => {
        let invalid = await fetchMock(newValues.nochwas.startsWith('a'), 3000);
        if (invalid) {
          return 'Das ist nicht ok';
        }
        return null;
      }
      recordErrorDelayed('nochwas', validation());

    }
  if (newValues.gutscheincode.length > 0) {
    if (newValues.gutscheincode.length < 3) {
      recordError('gutscheincode', 'Muss immer mindestens drei Zeichen lang sein');
    } else {
      const validation = async () => {
        let invalid = await fetchMock(newValues.gutscheincode.startsWith('a'), 4000);
        if (invalid) {
          return 'Gutscheincode nicht ok';
        }
        return null;
      }
      recordErrorDelayed('gutscheincode', validation());

    }
  }
}

function PizzaDetailsEditor(props: PizzaDetailsProps) {
  const initalPizzaDetails: PizzaDetails = { sauce: 'Classic', gutscheincode: '', nochwas: '' };
  const [overallFormState, form] = useForm<PizzaDetails>('PizzaDetails', validatePizzaDetails, initalPizzaDetails, () => { }, {}, props.parentForm);
  const { input, multi, custom } = form;
  const sauceInput = input('sauce');
  return <div>
    <Input label="Gutscheincode" {...input('gutscheincode')} />
    <Input label="Noch was" {...input('nochwas')} />

    <div className="FormGroup">
      <label>Sauce
        <select name='sauce' onBlur={sauceInput.onBlur} onChange={sauceInput.onChange}>
          <option value='Classic'>Classic</option>
          <option value='BBQ'>BBQ</option>
          <option value='Hollandaise'>Hollandaise</option>
        </select>
      </label>
      <ErrorDisplay visited={sauceInput.visited} errorMessages={sauceInput.errorMessages} />
      <div>{sauceInput.validating ? 'validating...' : ''}</div>
    </div>
    {JSON.stringify(overallFormState.errors)}
  </div>
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

const MemoPizzaEditor = React.memo(PizzaEditor, (oldProps, newProps) => {
  const ret = oldProps.count === newProps.count && isEqual(oldProps.initialValue, newProps.initialValue);
  return ret;
});
