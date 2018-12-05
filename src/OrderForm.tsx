import React, { useState } from "react";
// UI (independent from useForm hook)
import { Input } from "./form/Input";

// Form Logic
import { ValidateFn, useForm, ValueCreators, MultiEditorProps } from "./form/useForm";

interface OrderFormState {
  vorname: string;
  nachname: string;
  plz: string;
  pizzen: Pizza[];
}

interface Pizza {
  groesse: number;
  belaege: string;
}

// validatePizzaForm jetzt "kontextlos", dh zum Beispiel von außen testbar
const validatePizzaForm: ValidateFn<OrderFormState> = function (
  newFormInput,
  isVisited,
  recordError
) {
  if (newFormInput.vorname === "a") {
    window.setTimeout(() => recordError("vorname", "NAY"), 5000);
  }

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
};

export default function OrderForm() {
  function submit() {
    console.log("submitting", overallFormState.values);
  }

  const initialValues: OrderFormState = {
    vorname: "",
    nachname: "",
    plz: "",
    pizzen: [  ]
  };
  const valueCreators: ValueCreators<OrderFormState> = {
    pizzen: () => { return {groesse: 50,belaege:'alle'} }
      
    
  }

  const [state, setState] = useState(initialValues);
  const [overallFormState, [vornameInput, nachnameInput, plzInput, pizzenInput]] = useForm<
    OrderFormState
    >(validatePizzaForm, initialValues, submit, valueCreators);

  return (
    <div className="Form">
      <Input label="Vorname" {...vornameInput} />
      <Input label="Nachname" {...nachnameInput} />
      <Input label="PLZ" {...plzInput} />
      <button onClick={() => overallFormState.setValue("plz", "")}>
        Clear PLZ
      </button>
      <MultiPizzaEditor {...pizzenInput}/>
      <button disabled={overallFormState.hasErrors} onClick={overallFormState.handleSubmit} >
        Bestellen !
      </button>
    </div>
  );
}


function MultiPizzaEditor(props: MultiEditorProps<Pizza>) {
  const pizzaEditors = props.value.map(
    (pi, idx) => <div key={idx}><PizzaEditor
      {...props}
      pizza={pi}
      onChange={(pi) => props.onValueUpdate(pi, idx)}  
       />
      <button onClick={() => props.onRemove(idx)} >entfernen</button> 
    </div>
  );

  return <div>
    {pizzaEditors}
    <button onClick={() => props.onAdd()}>Pizza hinzufügen</button> 
  </div>
}

interface PizzaEditorProps {
  pizza: Pizza;
  onChange: (newPizza:Pizza) => void;
}
function PizzaEditor(props: PizzaEditorProps) {
  const { onChange, pizza } = props;
  return <div>
    <Input label="Größe" onBlur={(e:any) => onChange({...pizza, groesse: e.target.value})} />
    <Input label="Beläge" onBlur={(e:any) => onChange({...pizza, belaege: e.target.value})} />
  </div>
}



