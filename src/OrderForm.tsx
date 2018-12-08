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
    if (pizza.groesse > 50) {
      recordError(`pizzen[${idx}].groesse`, 'Eine Pizza darf maximal 50 cm groß sein');
    }
  });
  
}

export default function OrderForm() {
  function submit() {
    console.log("submitting", overallFormState.values);
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
  const [overallFormState, propsFor] = useForm<
    OrderFormState
    >(validatePizzaForm, initialValues, submit, valueCreators);

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
  console.log(props);
  const pizzaEditors = props.value.map(
    (pi:Pizza, idx: number) => <div key={idx}><PizzaEditor
      {...props.subEditorProps(pi,idx)}
    />
      <button onClick={() => props.onRemove(idx)} >entfernen</button>
    </div>

  );

  return <div>
    {pizzaEditors}
    pizzen Errors:{ props.errorMessages}

    <button onClick={() => props.onAdd()}>Pizza hinzufügen</button>
  </div>
}

interface PizzaEditorProps extends SubEditorProps<Pizza> {
}

/*
const pizzaValidator:ValidateFn<Pizza> = function (
  newPizza,
  isVisited,
  recordError
) {
  if (newPizza.groesse >= 70) {
    recordError('groesse', "Pizza darf maximal 70 cm groß sein");
  }

}
*/
/*
function adapter<T> (props:{onChange: (newPizza:Pizza) => void}, validate: ValidateFn<T>) {
    return 
}
*/
function PizzaEditor(props: PizzaEditorProps) {

  /*  const [overallFormState, [groesseInput, belaegeInput]] = useForm<
    Pizza
    >((newPizza, isVisited, recordError) => {props.onChange(newPizza); pizzaValidator(newPizza, isVisited, recordError)}, props.pizza, ()=>{});
  
  
    const { onChange, pizza } = props;
    console.log('pie props ', props);
    return <div>
      <Input label="Größe" {...groesseInput} />
      <Input label="Beläge" {...belaegeInput} />
      <div>Fehler: {props.errorMessages}</div>
    </div>*/
  const fieldProps = props.inputProps;
  
  return <div>
    <Input label="Größe" {...fieldProps('groesse')} />
    <Input label="Beläge" {...fieldProps('belaege')} />
  </div>

}



