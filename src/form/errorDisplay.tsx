import React from "react";

export default function ErrorDisplay(props: { visited: boolean, errorMessages?: string[] }) {
    const {errorMessages, visited} = props;
    return <div className="ErrorDisplay" >
        {visited && errorMessages ?
            <ul data-testid="error-display">{errorMessages.map((msg, ix) => <li data-testid="error-message" key={ix}>{msg}</li>)}</ul> :
            ''
        }
    </div>
}