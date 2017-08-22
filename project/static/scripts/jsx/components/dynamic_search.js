import React, { Component }  from 'react';

 class DynamicSearch extends Component {

    constructor(props){
        super(props);
    };

    getInitialState(){
        return { searchString: '' };
    }

    handleChange(){
        this.setState({searchString:event.target.value});        
    }

    render(){
    var countries = this.props.items;
    var searchString = this.state.searchString.trim().toLowerCase();
    // filter countries list by value from input box
    if(searchString.length > 0){
        countries = countries.filter(function(country){
        return country.name.toLowerCase().match( searchString );
        });
    }
    
    return (
        <div className="search-component">
        <input type="text" value={this.state.searchString} onChange={this.handleChange} placeholder="Search!" />
        <ul>
            { countries.map(function(country){ return <li>{country.name} </li> }) }
        </ul>
        </div>
    )}

 }  
 
 export default DynamicSearch
 