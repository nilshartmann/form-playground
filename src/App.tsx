import React, { Component } from "react";
import OrderForm from "./OrderForm";
import LoginForm from "./LoginForm";

class App extends Component {
  render() {
    return (
      <>
        <header>
          <h1>React Form Playground</h1>
          <div>React {React.version}</div>
        </header>
        <div className="PageContainer">
          <main>
            <h1>Example: Login Form</h1>
            <LoginForm />
            <h1>Pizza ist das Beste...</h1>
            <OrderForm submit={(values:any) => { console.log('submitted', values)}} />
          </main>
        </div>
      </>
    );
  }
}

export default App;
