import React, { useState } from "react";
// UI (independent from useForm hook)
import { Input } from "./form/Input";

// Form Logic
import { ValidateFn, useForm, ValueCreators, MultiFormInput, SubEditorProps } from "./form/useForm";

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
  if (newFormInput.pizzen.length === 0) {
    recordError('pizzen', 'Es muss mindestens eine Pizza bestellt werden');
  }
  newFormInput.pizzen.forEach((pizza, idx) =>  {
    if (isVisited(`pizzen[${idx}].groesse`) && pizza.groesse > 50) {
      recordError(`pizzen[${idx}].groesse`, 'Eine Pizza darf maximal 50 cm groß sein');
    }
  });
  
}
const initialValues: OrderFormState = {
  vorname: "test",
  nachname: "",
  plz: "",
  pizzen: []
};
const valueCreators: ValueCreators<OrderFormState> = {
  pizzen: () => { return { groesse: 60, belaege: 'alle' } }
}


export default function OrderForm() {
  function submit() {
    console.log("submitting", overallFormState.values);
  }

  const [overallFormState, propsFor] = useForm<OrderFormState>(validatePizzaForm, initialValues, submit, valueCreators);
  return (
    <div className="Form">
      <Input label="Vorname" {...propsFor('vorname')} />
      <Input label="Nachname" {...propsFor('nachname')} />
      <Input label="PLZ" {...propsFor('plz')} />
      <button onClick={() => overallFormState.setValue("plz", "")}>
        Clear PLZ
      </button>
      <MultiPizzaEditor {...propsFor('pizzen') as MultiFormInput<Pizza>} />
      <button disabled={overallFormState.hasErrors} onClick={overallFormState.handleSubmit} >
        Bestellen !
      </button>
      <button onClick={() => console.log(overallFormState.values)}>
        Show Form State
      </button>
    </div>
  );
}


function MultiPizzaEditor(props: MultiFormInput<Pizza>) {
  return <div>
    {
      props.value.map((pi:Pizza, idx: number) => 
        <div key={idx}>
          <PizzaEditor {...props.subEditorProps(pi,idx)} />
          <button onClick={() => props.onRemove(idx)} >entfernen</button>
        </div>
      )
    }
    pizzen Errors:{ props.errorMessages}
    <button onClick={() => props.onAdd()}>Pizza hinzufügen</button>
  </div>
}

function PizzaEditor(props: SubEditorProps<Pizza>) {
  const fieldProps = props.inputProps;
  return <div>
    <Input label="Größe" {...fieldProps('groesse')} />
    <Input label="Beläge" {...fieldProps('belaege')} />
  </div>
}



